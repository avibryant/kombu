import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "./assert"
import { DEBUG_logIrModule } from "./debug"
import * as ir from "./ir"
import { Loss } from "./loss"
import { defaultOptions, OptimizeOptions } from "./options"
import * as t from "./types"
import * as i from "./wasm/instr"
import { callSafely, instantiateModule } from "./wasm/mod"

const SIZEOF_F64 = 8
const WASM_PAGE_SIZE = 65536

class OptimizerCache {
  memory: WebAssembly.Memory
  sizeBytes: number

  constructor(public numEntries: number) {
    this.sizeBytes = numEntries * SIZEOF_F64
    this.memory = new WebAssembly.Memory({
      initial: Math.ceil(this.sizeBytes / WASM_PAGE_SIZE),
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

type CacheKey = t.Param | ir.CacheableExpr

class CodegenContext {
  cacheEntries = 0
  cacheOffsetById = new Map<CacheKey, number>()

  constructor(params: t.Param[]) {
    params.forEach((p) => {
      this.allocateCache(p)
    })
  }

  allocateCache(k: CacheKey): number {
    const offset = this.cacheEntries++ * SIZEOF_F64
    this.cacheOffsetById.set(k, offset)
    return offset
  }

  cacheOffset(k: CacheKey): number {
    return checkNotNull(this.cacheOffsetById.get(k))
  }
}

export function wasmOptimizer(loss: Loss, init: Map<t.Param, number>) {
  // Reorder params — the generated code assumes free params come first.
  const params = [...loss.freeParams, ...loss.fixedParams]

  const ctx = new CodegenContext(params)
  const mod = ir.module(loss)
  DEBUG_logIrModule(mod)

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

  const { exports } = instantiateModule(
    functions,
    cache.memory,
    cache.sizeBytes,
  )

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

    switch (options.method) {
      case "LBFGS":
        callSafely(
          exports,
          "optimizeLBFGS",
          loss.freeParams.length,
          maxIterations,
          options.m,
          options.epsilon,
        )
        break
      case "GradientDescent":
        callSafely(
          exports,
          "optimizeGradientDescent",
          loss.freeParams.length,
          maxIterations,
          options.learningRate,
        )
        break
      default:
        throw new Error(`unreachable`)
    }
    return new Map(
      params.map((p, i) => {
        return [p, cache.getParam(i)]
      }),
    )
  }

  function visitIrNode(node: ir.Expr, ctx: CodegenContext): i.WasmFragment {
    switch (node.type) {
      case ir.ExprType.Constant:
        return i.f64_const(node, node.value)
      case ir.ExprType.Precomputed:
        return i.f64_load(node, ctx.cacheOffset(node.exp))
      case ir.ExprType.Param:
        return i.f64_load(node, ctx.cacheOffset(node.param))
    }

    // Get the code that computes the result.
    let computeFrag =
      node.type === ir.ExprType.Unary
        ? visitUnary(node, ctx)
        : visitBinary(node, ctx)

    // If its reused, do compute, store, load. Otherwise, just compute.
    if (node.reused) {
      const cacheOffset = ctx.allocateCache(node)
      return i.seq(
        node,
        i.f64_store("store", cacheOffset, computeFrag),
        i.f64_load("load", cacheOffset),
      )
    }
    return computeFrag
  }

  function visitUnary(node: ir.UnaryExpr, ctx: CodegenContext): i.WasmFragment {
    return i.seq(
      node,
      visitIrNode(node.operand, ctx),
      i.callBuiltin(null, node.fn),
    )
  }

  function visitBinary(
    node: ir.BinaryExpr,
    ctx: CodegenContext,
  ): i.WasmFragment {
    const lfrag = visitIrNode(node.l, ctx)
    const rfrag = visitIrNode(node.r, ctx)
    if (node.op === "pow") {
      return i.seq(node, lfrag, rfrag, i.callBuiltin(null, "pow"))
    }
    switch (node.op) {
      case "+":
        return i.f64_binOp(node, "add", lfrag, rfrag)
      case "-":
        return i.f64_binOp(node, "sub", lfrag, rfrag)
      case "*":
        return i.f64_binOp(node, "mul", lfrag, rfrag)
      case "/":
        return i.f64_binOp(node, "div", lfrag, rfrag)
    }
  }

  return {
    optimize,
    evaluateLossForTesting: () => callSafely(exports, "evaluateLossForTesting"),
  }
}
