import * as w from "@wasmgroundup/emit"

import { Evaluator } from "./eval"
import * as t from "./types"

const builtins = ["log", "exp"]

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
    const idx = builtins.indexOf(name)
    if (idx === -1) throw new Error(`builtin '${name}' not found`)
    return [w.instr.call, w.funcidx(idx)]
}

function makeWasmModule(body: w.BytecodeFragment) {
    const mainFuncType = w.functype([w.valtype.f64], [w.valtype.f64])
    const builtinFuncType = w.functype([w.valtype.f64], [w.valtype.f64])

    const imports = builtins.map((name) =>
        w.import_("builtins", name, w.importdesc.func(0)),
    )

    const bytes = w.module([
        w.typesec([mainFuncType, builtinFuncType]),
        w.importsec(imports),
        w.funcsec([w.typeidx(0)]),
        w.exportsec([w.export_("main", w.exportdesc.func(0))]),
        w.codesec([w.code(w.func([], [...body, w.instr.end]))]),
    ])
    //    debugPrint(bytes);
    // `(mod as any[])` to avoid compiler error about excessively deep
    // type instantiation.
    return Uint8Array.from((bytes as any[]).flat(Infinity))
}

export function evaluator(_prefill: Map<t.Num, number>): Evaluator {
    const { instr } = w
    //    const numCache = new Map(prefill)

    function evaluate(num: t.Num): number {
        const bytes = makeWasmModule(emitNum(num))
        const { log, exp } = Math
        const mod = new WebAssembly.Module(bytes)
        const { exports } = new WebAssembly.Instance(mod, {
            builtins: { log, exp },
        })
        return exports.main()

        // let result = numCache.get(num)
        // if (result == undefined) {
        //     result = computeNum(num)
        //     numCache.set(num, result)
        // }
        // return result
        return 1
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

    function emitPow(base: w.BytecodeFragment, exponent: number) {
        if (exponent === -1) {
            return frag("Pow", instr.f64.const, w.f64(1), base, instr.f64.div)
        } else if (exponent === 1) {
            return base
        } else if (exponent === -2) {
            return frag(
                "Pow",
                instr.f64.const,
                w.f64(1),
                base,
                base,
                instr.f64.mul,
                instr.f64.div,
            )
        } else {
            throw new Error(`unhandled exponent: ${exponent}`)
        }
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
        let result = emitPow(emitCachedNum(node.x), node.a)
        if (node.nextTerm)
            return result.concat(emitProduct(node.nextTerm), instr.f64.mul)
        return result
    }

    function emitUnary(node: t.Term, type: t.UnaryFn): w.BytecodeFragment {
        switch (type) {
            // case "sign":
            //   if(evaluate(node) >= 0)
            //       return 1
            //   else
            //       return -1
            // case "abs":
            //     return Math.abs(evaluate(node))
            // case "cos":
            //     return Math.cos(evaluate(node))
            // case "sin":
            //     return Math.sin(evaluate(node))
            // case "atan":
            //     return Math.atan(evaluate(node))
            // case "exp":
            //     return Math.exp(evaluate(node))
            case "exp":
            case "log":
                return frag("Unary", emitCachedNum(node), callBuiltin(type))
            default:
                throw new Error(`not supported: ${type}`)
        }
    }

    return evaluate
}
