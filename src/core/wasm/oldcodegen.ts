import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "../assert"
import { callBuiltin, f64_const, f64_load, f64_store } from "./instr"
import { Loss } from "../loss"
import * as t from "../types"

type IdentifiableNum = t.Num & { id: number }

const SIZEOF_F64 = 8
const { instr } = w

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
}

function emitNum(num: t.Num, ctx: CodegenContext): w.BytecodeFragment {
  switch (num.type) {
    case t.NumType.Constant:
      return f64_const(num.value)
    case t.NumType.Param:
      return f64_const(Number.NaN)
    case t.NumType.Sum:
      return [emitSum(num.firstTerm, ctx), f64_const(num.k), instr.f64.add]
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
  let result = [f64_const(node.a), emitCachedNum(node.x, ctx), instr.f64.mul]
  if (node.nextTerm)
    return result.concat(emitSum(node.nextTerm, ctx), instr.f64.add)
  return result
}

function emitProduct(
  node: t.TermNode<t.ProductTerm>,
  ctx: CodegenContext,
): w.BytecodeFragment {
  let result = [
    emitCachedNum(node.x, ctx),
    f64_const(node.a),
    callBuiltin("pow"),
  ]
  if (node.nextTerm)
    return result.concat([emitProduct(node.nextTerm, ctx), instr.f64.mul])
  return result
}

function emitUnary(
  node: t.Term,
  type: t.UnaryFn,
  ctx: CodegenContext,
): w.BytecodeFragment {
  return [emitCachedNum(node, ctx), callBuiltin(type)]
}

export function oldCompile(loss: Loss) {
  const ctx = new CodegenContext()

  // Reorder params — the generated code assumes free params come first.
  const params = [...loss.freeParams, ...loss.fixedParams]
  params.forEach((p) => {
    ctx.allocateCache(p)
  })

  // Get a list of gradient values in the same order as `freeParams`.
  const gradientValues = loss.freeParams.map((p) =>
    checkNotNull(loss.gradient.elements.get(p)),
  )

  return [loss.value, ...gradientValues].map((num) => ({
    name: "",
    type: w.functype([], [w.valtype.f64]),
    body: emitCachedNum(num, ctx),
  }))
}

export function mergeRedundantFunctions(
  a: w.BytecodeFragment,
  b: w.BytecodeFragment,
): w.BytecodeFragment {
  // Compare the results of `a` and `b`, and abort if they differ.
  return [
    a,
    b,
    instr.f64.ne,
    [instr.if, w.blocktype()],
    instr.unreachable,
    instr.end,
    a,
  ]
}
