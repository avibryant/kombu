import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "./assert"
import { callBuiltin, f64_const, f64_load, f64_store } from "./wasm/instr"
import { instantiateModule } from "./wasm/mod"
import * as t from "./types"
import { Loss } from "./loss"
import * as ir from "./ir"

export interface LBFGSOptions {
  method: "LBFGS"
  epsilon: number
  m: number
}

export const defaultOptions: LBFGSOptions = {
  method: "LBFGS",
  epsilon: 0.1,
  m: 5,
}

export type OptimizeOptions = LBFGSOptions

type IdentifiableNum = t.Num & { id: number }

const SIZEOF_F64 = 8
const WASM_PAGE_SIZE = 65536

class OptimizerCache {
  memory: WebAssembly.Memory

  constructor(public numEntries: number) {
    const sizeBytes = numEntries * SIZEOF_F64
    this.memory = new WebAssembly.Memory({
      initial: Math.ceil(sizeBytes / WASM_PAGE_SIZE),
    })
  }

  getParam(idx: number): number {
    const cache = new Float64Array(this.memory.buffer, 0, this.numEntries)
    return cache[idx]
  }

  setParam(idx: number, val: number): void {
    const cache = new Float64Array(this.memory.buffer, 0, this.numEntries)
    cache[idx] = val
  }

  setParams(entries: [t.Param, number][]): void {
    const cache = new Float64Array(this.memory.buffer, 0, this.numEntries)
    entries.forEach(([_, val], idx) => {
      cache[idx] = val
    })
  }
}

class CodegenContext {
  cacheEntries = 0
  cacheOffsetById = new Map<number, number>()
  cacheOffsetById2 = new Map<ir.Expr | t.Param, number>()

  allocateCache(num: IdentifiableNum, numSlots = 1): number {
    const offset = this.cacheEntries * SIZEOF_F64
    this.cacheOffsetById.set(num.id, offset)
    this.cacheEntries += numSlots
    return offset
  }

  allocateCache2(exp: ir.Expr): number {
    const offset = this.cacheEntries++ * SIZEOF_F64
    this.cacheOffsetById2.set(exp, offset)
    return offset
  }

  allocateCacheForParam(p: t.Param): number {
    const offset = this.cacheEntries++ * SIZEOF_F64
    this.cacheOffsetById2.set(p, offset)
    return offset
  }

  cacheOffset(num: IdentifiableNum): number | undefined {
    return this.cacheOffsetById.get(num.id)
  }

  cacheOffset2(exp: ir.Expr): number {
    const key = exp.type === ir.ExprType.Param ? exp.param : exp
    return checkNotNull(this.cacheOffsetById2.get(key))
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

export function wasmOptimizer(loss: Loss, init: Map<t.Param, number>) {
  const { instr } = w
  const ctx = new CodegenContext()

  // Reorder params — the generated code assumes free params come first.
  const params = [...loss.freeParams, ...loss.fixedParams]

  // Get a list of gradient values in the same order as `freeParams`.
  const gradientValues = loss.freeParams.map((p) =>
    checkNotNull(loss.gradient.elements.get(p)),
  )

  const ctx2 = new CodegenContext()
  const mod = ir.module(loss)

  // Allocate storage for all params.
  params.forEach((p) => {
    ctx.allocateCache(p)
    ctx2.allocateCacheForParam(p)
  })

  const functions = [loss.value, ...gradientValues].map((num) => {
    return {
      name: "",
      type: w.functype([], [w.valtype.f64]),
      body: emitCachedNum(num, ctx),
    }
  })

  // Rewrite body to invoke
  functions[0].body = [
    functions[0].body,
    visitIrNode(mod.loss, ctx2),
    0x62, // f64.ne
    [w.instr.if, 0x40],
    w.instr.unreachable,
    w.instr.end,
    functions[0].body,
  ]

  const cache = new OptimizerCache(ctx.cacheEntries)

  // Initialize the cache with values for the free params.
  cache.setParams(loss.freeParams.map((p) => [p, checkNotNull(init.get(p))]))

  const { exports } = instantiateModule(functions, cache.memory)

  function optimize(
    maxIterations: number,
    observations: Map<t.Param, number>,
    opts?: OptimizeOptions,
  ): Map<t.Param, number> {
    loss.fixedParams.forEach((p, i) => {
      assert(observations.has(p), `Missing observation '${p.name}'`)
      const idx = loss.freeParams.length + i
      cache.setParam(idx, checkNotNull(observations.get(p)))
    })

    const options = {
      ...defaultOptions,
      ...(opts ?? {}),
    }

    if (typeof exports.optimize !== "function")
      throw new Error(`export 'optimize' not found or not callable`)
    ;(exports as any)["optimize"](
      loss.freeParams.length,
      maxIterations,
      options.m,
      options.epsilon,
    )
    return new Map(
      params.map((p, i) => {
        return [p, cache.getParam(i)]
      }),
    )
  }

  function visitIrNode(node: ir.Expr, ctx: CodegenContext): w.BytecodeFragment {
    switch (node.type) {
      case ir.ExprType.Constant:
        return frag("Constant", f64_const(node.value))
      case ir.ExprType.Precomputed:
        return frag("precomp", f64_load(ctx.cacheOffset2(node.exp)))
      case ir.ExprType.Param:
        return frag("precomp", f64_load(ctx.cacheOffset2(node)))
    }

    // Get the code that computes the result.
    let computeFrag =
      node.type === ir.ExprType.Unary
        ? frag("unary", visitUnary(node, ctx))
        : frag("binary", visitBinary(node, ctx))

    // If its reused, do compute, store, load. Otherwise, just compute.
    if (node.reused) {
      const cacheOffset = ctx.allocateCache2(node)
      return [
        frag("store", f64_store(cacheOffset, computeFrag)),
        f64_load(cacheOffset),
      ]
    }
    return computeFrag
  }

  function visitUnary(
    node: ir.UnaryExpr,
    ctx: CodegenContext,
  ): w.BytecodeFragment {
    return frag("Unary", visitIrNode(node.operand, ctx), callBuiltin(node.fn))
  }

  function visitBinary(
    node: ir.BinaryExpr,
    ctx: CodegenContext,
  ): w.BytecodeFragment {
    const opImpl =
      node.op === "+"
        ? instr.f64.add
        : node.op === "*"
        ? instr.f64.mul
        : callBuiltin("pow")
    return frag(
      node.op,
      frag("l", visitIrNode(node.l, ctx)),
      frag("r", visitIrNode(node.r, ctx)),
      opImpl,
    )
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
    let cacheOffset = ctx.cacheOffset(num)
    if (cacheOffset === undefined) {
      assert(num.type !== t.NumType.Param, "no cache found for param")
      cacheOffset = ctx.allocateCache(num)

      // Compute the result and write to the cache.
      result.push(f64_store(cacheOffset, emitNum(num, ctx)))
    }
    // Read from the cache.
    result.push(f64_load(cacheOffset))
    return result
  }

  function emitSum(
    node: t.TermNode<t.SumTerm>,
    ctx: CodegenContext,
  ): w.BytecodeFragment {
    let result = frag(
      "Mul",
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
    return frag("Unary", emitCachedNum(node, ctx), callBuiltin(type))
  }

  return optimize
}
