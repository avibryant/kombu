import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "./assert"
import { callBuiltin, f64_const, f64_load, f64_store } from "./wasm/instr"
import { instantiateModule } from "./wasm/mod"
import * as t from "./types"

const SIZEOF_F64 = 8

type IdentifiableNum = t.Num & { id: number }

// For each parameter, we reserve multiple f64 slots.
// The first slot holds the parameter value itself. Currently the second
// slot is used to hold the moving average the gradient.
const cacheSlotsPerParam = 2

class OptimizerCache {
  memory: WebAssembly.Memory
  cache: Float64Array

  constructor(size: number) {
    this.memory = new WebAssembly.Memory({ initial: size })
    this.cache = new Float64Array(this.memory.buffer)
  }

  getParam(idx: number): number {
    return this.cache[idx * cacheSlotsPerParam]
  }

  setParam(idx: number, val: number): void {
    this.cache[idx * cacheSlotsPerParam] = val
  }

  setParams(entries: [t.Param, number][]): void {
    entries.forEach(([_, val], i) => {
      this.setParam(i, val)
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

  memorySize() {
    return this.cacheEntries * SIZEOF_F64
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

export function optimizer(
  loss: t.Num,
  gradient: Map<t.Param, t.Num>,
  params: Map<t.Param, number>,
) {
  const startTime = window.performance.now()
  const { instr } = w
  const ctx = new CodegenContext()

  // Get a list of [param, value] in the same order as `gradient.values()`.
  const paramEntries: [t.Param, number][] = Array.from(gradient.keys()).map(
    (p) => [p, checkNotNull(params.get(p))],
  )
  // Add on any params that are not in the gradient; these are fixed.
  params.forEach((val, p) => {
    if (!gradient.has(p)) paramEntries.push([p, val])
  })
  const gradientValues = Array.from(gradient.values())

  // Allocate storage for the params up front. For each parameter, allocate
  // two f64 slots: one for the current value, and one for temporary data
  // used by the optimization algorithm.
  paramEntries.forEach(([param]) => {
    ctx.allocateCache(param, 2)
  })

  const functions = [loss, ...gradientValues].map((num) => ({
    name: "",
    type: w.functype([], [w.valtype.f64]),
    body: emitCachedNum(num, ctx),
  }))

  const cache = new OptimizerCache(ctx.memorySize())
  cache.setParams(paramEntries)

  const { exports } = instantiateModule(functions, cache.memory)

  function optimize(iterations: number): Map<t.Param, number> {
    if (typeof exports.optimize !== "function")
      throw new Error(`export 'optimize' not found or not callable`)
    ;(exports as any)["optimize"](
      gradientValues.length,
      iterations,
      0.001, // learning rate
      1e-6, // epsilon
      0.99, // decay
    )

    return new Map(
      paramEntries.map(([param], i) => {
        return [param, cache.getParam(i)]
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

  //  console.log(`created optimizer in ${window.performance.now() - startTime}ms`)
  return { optimize }
}
