import { checkNotNull } from "./assert"
import * as t from "./types"

export interface Evaluator {
  evaluate: (inp: t.Num) => number
  state: ComputeState
}

export class ComputeState {
  private numCache: Map<t.Num, [number, number]> = new Map()
  private epoch = 0

  constructor(params: Map<t.Param, number>) {
    this.setParams(params)
  }

  hasParam(param: t.Param): boolean {
    return this.numCache.has(param)
  }

  setParams(params: Map<t.Param, number>) {
    this.epoch += 1
    for (const [p, val] of params) {
      this.numCache.set(p, [Infinity, val])
    }
  }

  setParam(param: t.Param, val: number): void {
    this.epoch += 1
    this.numCache.set(param, [Infinity, val])
  }

  writeCache(n: t.Num, val: number) {
    this.numCache.set(n, [this.epoch, val])
  }

  getParam(param: t.Param): number | undefined {
    if (!this.numCache.has(param)) return undefined
    const [_, val] = checkNotNull(this.numCache.get(param)) // ignore validity
    return val
  }

  readCache(n: t.Num) {
    if (!this.numCache.has(n)) return undefined
    const [validity, val] = checkNotNull(this.numCache.get(n))
    return validity >= this.epoch ? val : undefined
  }
}

export function evaluator(state: ComputeState): Evaluator {
  function evaluate(num: t.Num): number {
    let result = state.readCache(num)
    if (result === undefined) {
      result = computeNum(num)
      state.writeCache(num, result)
    }
    return result
  }

  function computeNum(num: t.Num): number {
    switch (num.type) {
      case t.NumType.Constant:
        return num.value
      case t.NumType.Param:
        return NaN
      case t.NumType.Sum:
        return evaluateSum(num.firstTerm) + num.k
      case t.NumType.Product:
        return evaluateProduct(num.firstTerm)
      case t.NumType.Unary:
        return evaluateUnary(num.term, num.fn)
    }
  }

  function evaluateSum(node: t.TermNode<t.SumTerm>): number {
    let result = node.a * evaluate(node.x)
    if (node.nextTerm) result += evaluateSum(node.nextTerm)
    return result
  }

  function evaluateProduct(node: t.TermNode<t.ProductTerm>): number {
    let result = Math.pow(evaluate(node.x), node.a)
    if (node.nextTerm) result *= evaluateProduct(node.nextTerm)
    return result
  }

  function evaluateUnary(node: t.Term, type: t.UnaryFn): number {
    switch (type) {
      case "abs":
        return Math.abs(evaluate(node))
      case "sign":
        if (evaluate(node) >= 0) return 1
        else return -1
      case "cos":
        return Math.cos(evaluate(node))
      case "sin":
        return Math.sin(evaluate(node))
      case "atan":
        return Math.atan(evaluate(node))
      case "exp":
        return Math.exp(evaluate(node))
      case "log":
        return Math.log(evaluate(node))
    }
  }

  return { evaluate, state }
}
