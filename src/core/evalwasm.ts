import * as w from "@wasmgroundup/emit"

import { checkNotNull } from "./assert"
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

class CodegenContext {
  globalsCount: number = 0
  private idToGlobalidx = new Map<number, number>()
  private globalValByIdx = new Map<number, number>()

  constructor(private paramValues: Map<t.Num, number>) {}

  maybeAllocateGlobals(num: t.Num): number {
    // For every Identifiable node, allocate two globals: (1) an f64 for the
    // cached value, and (2) an i32 as a flag (is it cached?).
    // TODO: Should we be concerned about alignment here?
    const idx = this.globalsCount
    this.globalsCount += 2
    this.idToGlobalidx.set(num.id, idx)

    // Record the initial value if we have one.
    if (this.paramValues.has(num)) {
      this.globalValByIdx.set(idx, checkNotNull(this.paramValues.get(num)))
    }

    return idx
  }

  globalidx(num: t.Num): number {
    return this.idToGlobalidx.get(num.id) ?? -1
  }

  initialGlobalValOrElse(idx: number, fn: () => number): number {
    return this.globalValByIdx.get(idx) ?? fn()
  }

  initialGlobalFlag(idx: number) {
    return this.globalValByIdx.has(idx) ? 1 : 0
  }
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

function makeWasmModule(
  namesAndBodies: [string, w.BytecodeFragment][],
  ctx: CodegenContext,
) {
  const mainFuncType = w.functype([], [w.valtype.f64])
  const builtinFuncType1 = w.functype([w.valtype.f64], [w.valtype.f64])
  const builtinFuncType2 = w.functype(
    [w.valtype.f64, w.valtype.f64],
    [w.valtype.f64],
  )

  const imports = builtinNames.map((name) => {
    // TODO: Find a cleaner way of doing this?
    const sigIdx = name === "pow" ? 2 : 1
    return w.import_("builtins", name, w.importdesc.func(sigIdx))
  })
  const mainFuncidx = imports.length

  const globals = []
  for (let i = 0; i < ctx.globalsCount; i += 2) {
    const initialVal = ctx.initialGlobalValOrElse(i, () => Math.random())
    const initialFlag = ctx.initialGlobalFlag(i)
    globals.push(
      w.global(w.globaltype(w.valtype.f64, w.mut.var), [
        f64_const(initialVal),
        w.instr.end,
      ]),
      w.global(w.globaltype(w.valtype.i32, w.mut.var), [
        [w.instr.i32.const, initialFlag],
        w.instr.end,
      ]),
    )
  }

  const bytes = w.module([
    w.typesec([mainFuncType, builtinFuncType1, builtinFuncType2]),
    w.importsec(imports),
    w.funcsec([w.typeidx(0)]),
    w.globalsec(globals),
    w.exportsec([w.export_("main", w.exportdesc.func(mainFuncidx))]),
    w.codesec(
      namesAndBodies.map(([_, body]) =>
        w.code(w.func([], frag("code", ...body, w.instr.end))),
      ),
    ),
  ])
  //    debugPrint(bytes)
  // `(mod as any[])` to avoid compiler error about excessively deep
  // type instantiation.
  return Uint8Array.from((bytes as any[]).flat(Infinity))
}

export function evaluator(
  nums: t.Num[],
  params: Map<t.Param, number>,
): Evaluator {
  const { instr } = w

  const ctx = new CodegenContext(params)
  const functionBodies = nums.map((num) => [
    `compute${num.id}`,
    compileNum(num, ctx),
  ])
  const bytes = makeWasmModule(functionBodies, ctx)
  const mod = new WebAssembly.Module(bytes)
  const { exports } = new WebAssembly.Instance(mod, { builtins })
  return (exports as any).main()

  function evaluate(num: t.Num): number {
    return 0
  }

  function compileNum(num, ctx: CodegenContext) {
    const body = emitCachedNum(num, ctx)
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
