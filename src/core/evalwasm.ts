import * as w from "@wasmgroundup/emit"

import { Evaluator } from "./eval"
import * as t from "./types"

const builtins = {
    log: Math.log,
    exp: Math.exp,
    pow: Math.pow,
    sign: Math.sign,
    abs: Math.abs,
    cos: Math.cos,
    sin: Math.sin,
    atan: Math.atan,
}
const builtinNames = Object.keys(builtins)

interface Cacheable {
    id: number
}

function checkCacheable(num: t.Num): Cacheable {
    if (!("id" in num)) {
        throw new Error(`not Cacheable: ${num}`)
    }
    return num as Cacheable
}

function checkNotNull<T>(x: T): NonNullable<T> {
    if (x == null) {
        throw new Error(`unexpected null: ${x}`)
    }
    return x
}

class CodegenContext {
    globalsCount: number = 0
    private idToGlobalidx = new Map<number, number>()

    maybeAllocateGlobals(num: t.Num): number {
        // For every `t.Num` that is cacheable, allocate two globals:
        // an i32 as a flag (is it cached?) and an f64 for the cached value.
        // TODO: Should we be concerned about alignment here?
        if (!("id" in num)) return -1
        if (!this.idToGlobalidx.has(num.id)) {
            const idx = this.globalsCount
            this.globalsCount += 2
            this.idToGlobalidx.set(num.id, idx)
        }
        return checkNotNull(this.idToGlobalidx.get(num.id))
    }

    globalidx(c: Cacheable) {
        if (!this.idToGlobalidx.has(c.id)) {
            throw new Error(`No global for id '${c.id}'`)
        }
        return checkNotNull(this.idToGlobalidx.get(c.id))
    }
}

function frag(dbg: string, ...fragment: w.BytecodeFragment) {
    const arr = Array.from(fragment)
    ;(arr as any).dbg = dbg
    return arr
}

let count = 0
function debugPrint(frag: any[], depth = 0) {
    const log = (...args) => console.log(new Array(depth).join("  "), ...args)
    if ((frag as any).dbg) log(`[${(frag as any).dbg}]`)
    if (Array.isArray(frag)) frag.forEach((x) => debugPrint(x, depth + 1))
    else log(`@${count++} ${frag} (0x${(frag as any).toString(16)})`)
}

function callBuiltin(name: string): w.BytecodeFragment {
    const idx = builtinNames.indexOf(name)
    if (idx === -1) throw new Error(`builtin '${name}' not found`)
    return [w.instr.call, w.funcidx(idx)]
}

function makeWasmModule(
    body: w.BytecodeFragment,
    numGlobals: number,
    prefill: Map<number, number>,
) {
    const mainFuncType = w.functype([], [w.valtype.f64])
    const builtinFuncType = w.functype([w.valtype.f64], [w.valtype.f64])

    const imports = builtinNames.map((name) =>
        w.import_("builtins", name, w.importdesc.func(0)),
    )
    const mainFuncidx = imports.length

    const globals = []
    for (let i = 0; i < numGlobals; i++) {
        const initialVal = prefill.get(i) ?? Math.random()
        const initialFlag = prefill.has(i) ? 1 : 0
        globals.push(
            w.global(w.globaltype(w.valtype.f64, w.mut.var), [
                [w.instr.f64.const, w.f64(initialVal)],
                w.instr.end,
            ]),
            w.global(w.globaltype(w.valtype.i32, w.mut.var), [
                [w.instr.i32.const, initialFlag],
                w.instr.end,
            ]),
        )
    }

    const bytes = w.module([
        w.typesec([mainFuncType, builtinFuncType]),
        w.importsec(imports),
        w.funcsec([w.typeidx(0)]),
        w.globalsec(globals),
        w.exportsec([w.export_("main", w.exportdesc.func(mainFuncidx))]),
        w.codesec([w.code(w.func([], frag("code", ...body, w.instr.end)))]),
    ])
    debugPrint(bytes)
    // `(mod as any[])` to avoid compiler error about excessively deep
    // type instantiation.
    return Uint8Array.from((bytes as any[]).flat(Infinity))
}

export function evaluator(prefill: Map<t.Num, number>): Evaluator {
    const { instr } = w

    function evaluate(num: t.Num): number {
        const ctx = new CodegenContext()
        const body = emitCachedNum(num, ctx)
        const prefillById = new Map(
            Array.from(prefill.entries()).map(([k, v]) => [
                ctx.globalidx(checkCacheable(k)),
                v,
            ]),
        )
        const bytes = makeWasmModule(body, ctx.globalsCount, prefillById)
        const mod = new WebAssembly.Module(bytes)
        const { exports } = new WebAssembly.Instance(mod, { builtins })
        return (exports as any).main()
    }

    function emitNum(num: t.Num, ctx: CodegenContext): w.BytecodeFragment {
        switch (num.type) {
            case t.NumType.Constant:
                return frag("Constant", instr.f64.const, w.f64(num.value))
            case t.NumType.Param:
                return frag("Param", instr.f64.const, w.f64(Number.NaN))
            case t.NumType.Sum:
                return frag(
                    "Sum",
                    emitSum(num.firstTerm, ctx),
                    instr.f64.const,
                    w.f64(num.k),
                    instr.f64.add,
                )
            case t.NumType.Product:
                return emitProduct(num.firstTerm, ctx)
            case t.NumType.Unary:
                return emitUnary(num.term, num.fn, ctx)
        }
    }

    function emitCachedNum(
        num: t.Num,
        ctx: CodegenContext,
    ): w.BytecodeFragment {
        const idx = ctx.maybeAllocateGlobals(num)
        if (idx === -1) {
            return emitNum(num, ctx) // Not cacheable
        }
        // Even indices are cached values (f64), odd indices are flags (i32).
        const cachedValueIdx = w.u32(idx)
        const cachedFlagIdx = w.u32(idx + 1)

        return frag(
            `CachedNum${cachedValueIdx}`,
            [instr.global.get, cachedFlagIdx, instr.i32.eqz], // already cached?
            [instr.if, w.blocktype()],
            emitNum(num, ctx),
            [instr.global.set, cachedValueIdx], // update cache
            // set cached flag
            [instr.i32.const, 1, instr.global.set, cachedFlagIdx],
            instr.end,
            [instr.global.get, cachedValueIdx], // return cached value
        )
    }

    function emitSum(
        node: t.TermNode<t.SumTerm>,
        ctx: CodegenContext,
    ): w.BytecodeFragment {
        let result = frag(
            "Sum2",
            instr.f64.const,
            w.f64(node.a),
            emitCachedNum(node.x, ctx),
            instr.f64.mul,
        )
        if (node.nextTerm)
            return result.concat(emitSum(node.nextTerm, ctx), instr.f64.add)
        return result
    }

    function emitProduct(
        node: t.TermNode<t.ProductTerm>,
        ctx: CodegenContext,
    ): w.BytecodeFragment {
        let result = frag(
            "Pow",
            emitCachedNum(node.x, ctx),
            w.f64(node.a),
            callBuiltin("pow"),
        )
        if (node.nextTerm)
            return result.concat(emitProduct(node.nextTerm, ctx), instr.f64.mul)
        return result
    }

    function emitUnary(
        node: t.Term,
        type: t.UnaryFn,
        ctx: CodegenContext,
    ): w.BytecodeFragment {
        if (!builtinNames.includes(type)) {
            throw new Error(`not supported: ${type}`)
        }
        return frag("Unary", emitCachedNum(node, ctx), callBuiltin(type))
    }

    return evaluate
}
