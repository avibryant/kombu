import * as t from "./types"

export interface Evaluator {
  evaluate: (inp: t.Num) => number
  params: Map<t.Param, number>
}

export function evaluator(params: Map<t.Param, number>): Evaluator {
  const numCache: Map<t.Num, number> = new Map(params)
  function evaluate(num: t.Num): number {
    let result = numCache.get(num)
    if (result == undefined) {
      result = computeNum(num)
      numCache.set(num, result)
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

  return { evaluate, params }
}
