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

function frag(dbg: string, ...fragment: w.BytecodeFragment) {
    const arr = Array.from(fragment)
    ;(arr as any).dbg = dbg
    return arr
}

let count = 0
function debugPrint(frag: any[], depth = 0) {
    if (frag.dbg) console.log(`[${frag.dbg}]`)
    if (Array.isArray(frag)) frag.forEach((x, i) => debugPrint(x, depth + 1))
    else
        console.log(
            `${new Array(depth).join(
                " ",
            )}@${count++} ${frag} (0x${frag.toString(16)})`,
        )
}

function callBuiltin(name: string): w.BytecodeFragment {
    const idx = builtinNames.indexOf(name)
    if (idx === -1) throw new Error(`builtin '${name}' not found`)
    return [w.instr.call, w.funcidx(idx)]
}

function makeWasmModule(body: w.BytecodeFragment) {
    const mainFuncType = w.functype([], [w.valtype.f64])
    const builtinFuncType = w.functype([w.valtype.f64], [w.valtype.f64])

    const imports = builtinNames.map((name) =>
        w.import_("builtins", name, w.importdesc.func(0)),
    )
    const mainFuncidx = imports.length

    const bytes = w.module([
        w.typesec([mainFuncType, builtinFuncType]),
        w.importsec(imports),
        w.funcsec([w.typeidx(0)]),
        w.exportsec([w.export_("main", w.exportdesc.func(mainFuncidx))]),
        w.codesec([w.code(w.func([], frag("code", ...body, w.instr.end)))]),
    ])
    debugPrint(bytes)
    // `(mod as any[])` to avoid compiler error about excessively deep
    // type instantiation.
    return Uint8Array.from((bytes as any[]).flat(Infinity))
}

export function evaluator(_prefill: Map<t.Num, number>): Evaluator {
    const { instr } = w
    //    const numCache = new Map(prefill)

    function evaluate(num: t.Num): number {
        const bytes = makeWasmModule(emitNum(num))
        const mod = new WebAssembly.Module(bytes)
        const { exports } = new WebAssembly.Instance(mod, { builtins })
        return exports.main()

        // let result = numCache.get(num)
        // if (result == undefined) {
        //     result = computeNum(num)
        //     numCache.set(num, result)
        // }
        // return result
    }

    function emitNum(num: t.Num): w.BytecodeFragment {
        switch (num.type) {
            case t.NumType.Constant:
                return frag("Constant", instr.f64.const, w.f64(num.value))
            case t.NumType.Param:
                return frag("Param", instr.f64.const, w.f64(Number.NaN))
            case t.NumType.Sum:
                return frag(
                    "Sum",
                    emitSum(num.firstTerm),
                    instr.f64.const,
                    w.f64(num.k),
                    instr.f64.add,
                )
            case t.NumType.Product:
                return emitProduct(num.firstTerm)
            case t.NumType.Unary:
                return emitUnary(num.term, num.fn)
        }
    }

    // TODO: Add cache.
    function emitCachedNum(num: t.Num): w.BytecodeFragment {
        return emitNum(num)
    }

    function emitSum(node: t.TermNode<t.SumTerm>): w.BytecodeFragment {
        let result = frag(
            "Sum2",
            instr.f64.const,
            w.f64(node.a),
            emitCachedNum(node.x),
            instr.f64.mul,
        )
        if (node.nextTerm)
            return result.concat(emitSum(node.nextTerm), instr.f64.add)
        return result
    }

    function emitProduct(node: t.TermNode<t.ProductTerm>): w.BytecodeFragment {
        let result = frag(
            "Pow",
            emitCachedNum(node.x),
            w.f64(node.a),
            callBuiltin("pow"),
        )
        if (node.nextTerm)
            return result.concat(emitProduct(node.nextTerm), instr.f64.mul)
        return result
    }

    function emitUnary(node: t.Term, type: t.UnaryFn): w.BytecodeFragment {
        if (!builtinNames.includes(type)) {
            throw new Error(`not supported: ${type}`)
        }
        return frag("Unary", emitCachedNum(node), callBuiltin(type))
    }

    return evaluate
}
