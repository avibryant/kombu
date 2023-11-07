import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "./assert"
import { callBuiltin, f64_const, f64_load, f64_store } from "./wasm/instr"
import { instantiateModule } from "./wasm/mod"
import * as t from "./types"
import { Loss } from "./loss"

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

  allocateCache(num: IdentifiableNum, numSlots = 1): number {
    const offset = this.cacheEntries * SIZEOF_F64
    this.cacheOffsetById.set(num.id, offset)
    this.cacheEntries += numSlots
    return offset
  }

  cacheOffset(num: IdentifiableNum): number | undefined {
    return this.cacheOffsetById.get(num.id)
  }

  cacheOffsetForParam(p: t.Param) {
    return checkNotNull(this.cacheOffset(p))
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

  // Allocate storage for all params.
  params.forEach((p) => {
    ctx.allocateCache(p)
  })

  const functions = [loss.value, ...gradientValues].map((num) => ({
    name: "",
    type: w.functype([], [w.valtype.f64]),
    body: emitCachedNum(num, ctx),
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
    return frag("Unary", emitCachedNum(node, ctx), callBuiltin(type))
  }

  return optimize
}
