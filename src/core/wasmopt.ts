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
  cacheOffsetById = new Map<ir.Expr | t.Param, number>()

  constructor(params: t.Param[]) {
    params.forEach((p) => {
      this.allocateCacheForParam(p)
    })
  }

  allocateCache2(exp: ir.Expr): number {
    const offset = this.cacheEntries++ * SIZEOF_F64
    this.cacheOffsetById.set(exp, offset)
    return offset
  }

  allocateCacheForParam(p: t.Param): number {
    const offset = this.cacheEntries++ * SIZEOF_F64
    this.cacheOffsetById.set(p, offset)
    return offset
  }

  cacheOffset2(exp: ir.Expr): number {
    const key = exp.type === ir.ExprType.Param ? exp.param : exp
    return checkNotNull(this.cacheOffsetById.get(key))
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

  // Reorder params — the generated code assumes free params come first.
  const params = [...loss.freeParams, ...loss.fixedParams]

  const ctx = new CodegenContext(params)
  const mod = ir.module(loss)

  // Get a list of gradient IR nodes in the same order as `freeParams`.
  const gradientNodes = loss.freeParams.map((p) =>
    checkNotNull(mod.gradient.get(p)),
  )

  const functions = [mod.loss, ...gradientNodes].map((node) => ({
    name: "",
    type: w.functype([], [w.valtype.f64]),
    body: visitIrNode(node, ctx),
  }))

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

  return optimize
}
