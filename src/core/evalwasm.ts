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

function f64_const(v: number): w.BytecodeFragment {
  return frag("f64_const", w.instr.f64.const, w.f64(v))
}

type IdentifiableNum = t.Num & { id: number }

function checkIdentifiable(num: t.Num): IdentifiableNum {
  if (num.type === t.NumType.Constant) {
    throw new Error(`expected num with an id, get: Const(${num.value})`)
  }
  return num;
}

class CodegenContext {
  globals: { type: number; initExpr: w.BytecodeFragment | undefined }[] = []
  idToGlobalidx = new Map<number, number>()
  functypeToIdx = new Map<string, number>()
  functypes: w.BytecodeFragment = []

  allocateGlobal(num: IdentifiableNum, initialVal: number): number {
    const idx = this.globals.length
    this.idToGlobalidx.set(num.id, idx)

    this.globals.push({ type: w.valtype.f64, initExpr: f64_const(initialVal) })
    return idx
  }

  globalidx(num: IdentifiableNum): number {
    return this.idToGlobalidx.get(num.id) ?? -1
  }

  typeidxForFunctype(type: w.BytecodeFragment): w.BytecodeFragment {
    return w.typeidx(this.functypeToIdx.get(JSON.stringify(type))!)
  }

  recordFunctype(type: w.BytecodeFragment): number {
    const k = JSON.stringify(type)
    if (this.functypeToIdx.has(k)) {
      return this.functypeToIdx.get(k)!
    }
    const idx = this.functypeToIdx.size
    this.functypeToIdx.set(k, idx)
    this.functypes.push(type)
    return idx
  }
}

interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: w.BytecodeFragment
}

function frag(dbg: string, ...fragment: w.BytecodeFragment) {
  const arr = Array.from(fragment)
  ;(arr as any).dbg = dbg
  return arr
}

let count = 0
// @ts-ignore 'debugPrint' is declared but its value is never read.
function debugPrint(frag: any[], depth = 0) {
  const log = (...args: any[]) =>
    console.log(new Array(depth).join("  "), ...args)
  if ((frag as any).dbg) log(`[${(frag as any).dbg}]`)
  if (Array.isArray(frag)) frag.forEach((x) => debugPrint(x, depth + 1))
  else log(`@${count++} ${frag} (0x${(frag as any).toString(16)})`)
}

function callBuiltin(name: string): w.BytecodeFragment {
  const idx = builtinNames.indexOf(name)
  if (idx === -1) throw new Error(`builtin '${name}' not found`)
  return [w.instr.call, w.funcidx(idx)]
}

function makeWasmModule(functions: WasmFunction[], ctx: CodegenContext) {
  const builtinType1 = w.functype([w.valtype.f64], [w.valtype.f64])
  const builtinType2 = w.functype(
    [w.valtype.f64, w.valtype.f64],
    [w.valtype.f64],
  )

  ;[builtinType1, builtinType2].forEach((t) => ctx.recordFunctype(t))
  functions.forEach(({ type }) => ctx.recordFunctype(type))

  const imports = builtinNames.map((name) => {
    // TODO: Find a cleaner way of doing this?
    const typeIdx = ctx.recordFunctype(
      name === "pow" ? builtinType2 : builtinType1,
    )
    return frag(
      "import" + name,
      w.import_(
        "builtins",
        name,
        frag("importdesc" + name, w.importdesc.func(typeIdx)),
      ),
    )
  })
  const bytes = w.module([
    w.typesec(ctx.functypes),
    w.importsec(frag("imports", ...imports)),
    w.funcsec(functions.map(({ type }) => w.typeidx(ctx.recordFunctype(type)))),
    w.globalsec(
      ctx.globals.map((g) =>
        w.global(w.globaltype(g.type, w.mut.var), [g.initExpr, w.instr.end]),
      ),
    ),
    w.exportsec(
      functions.map(({ name }, i) =>
        w.export_(name, w.exportdesc.func(imports.length + i)),
      ),
    ),
    w.codesec(
      functions.map(({ body }) =>
        w.code(w.func([], frag("code", ...body, w.instr.end))),
      ),
    ),
  ])
  //debugPrint(bytes)
  // `(mod as any[])` to avoid compiler error about excessively deep
  // type instantiation.
  return Uint8Array.from((bytes as any[]).flat(Infinity))
}

export function evaluator(
  nums: t.Num[],
  params: Map<t.Param, number>,
): Evaluator {
  const { instr } = w
  const ctx = new CodegenContext()
  const functions = nums.map((num) => ({
    name: `compute${checkIdentifiable(num).id}`,
    type: w.functype([], [w.valtype.f64]),
    body: emitCachedNum(num, ctx),
  }))
  const bytes = makeWasmModule(functions, ctx)
  const mod = new WebAssembly.Module(bytes)
  const { exports } = new WebAssembly.Instance(mod, { builtins })

  function initialCacheValue(num: t.Num): number {
    if (num.type === t.NumType.Param) {
      return params.get(num) ?? Math.random()
    }
    return 0
  }

  function evaluate(num: t.Num): number {
    if (num.type === t.NumType.Constant) {
      return num.value
    }
    const name = `compute${num.id}`
    if (typeof exports[name] === "function") {
      return (exports as any)[name]()
    } else {
      throw new Error(`export '${name}' not found or not callable`)
    }
  }

  function emitNum(num: t.Num, ctx: CodegenContext): w.BytecodeFragment {
    switch (num.type) {
      case t.NumType.Constant:
        return frag("Constant", f64_const(num.value))
      case t.NumType.Param:
        return frag("Param", f64_const(Number.NaN))
      case t.NumType.Sum:
        return frag(
          "Sum",
          emitSum(num.firstTerm, ctx),
          f64_const(num.k),
          instr.f64.add,
        )
      case t.NumType.Product:
        return emitProduct(num.firstTerm, ctx)
      case t.NumType.Unary:
        return emitUnary(num.term, num.fn, ctx)
    }
  }

  function emitCachedNum(num: t.Num, ctx: CodegenContext): w.BytecodeFragment {
    // Constants are never cached.
    if (num.type === t.NumType.Constant) return emitNum(num, ctx)

    let result = []
    let cacheIdx = ctx.globalidx(num)
    if (cacheIdx === -1) {
      cacheIdx = ctx.allocateGlobal(num, initialCacheValue(num))

      // For non-Params, compute the result and write to the cache.
      // For Params, the global is initialized with the correct value.
      if (num.type !== t.NumType.Param) {
        result.push(emitNum(num, ctx), instr.global.set, w.u32(cacheIdx))
      }
    }
    // Read from the cache.
    result.push(instr.global.get, w.u32(cacheIdx))
    return result
  }

  function emitSum(
    node: t.TermNode<t.SumTerm>,
    ctx: CodegenContext,
  ): w.BytecodeFragment {
    let result = frag(
      "Sum2",
      f64_const(node.a),
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
      f64_const(node.a),
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

  return { evaluate, params }
}
