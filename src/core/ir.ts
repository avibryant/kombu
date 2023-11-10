import { checkNotNull } from "./assert"
import { Loss } from "./loss"
import * as t from "./types"

export type Expr = CacheableExpr | ConstantExpr | ParamExpr | PrecomputedExpr
export type CacheableExpr = BinaryExpr | UnaryExpr

export enum ExprType {
  Constant,
  Param,
  Unary,
  Binary,
  Precomputed,
}

export interface ConstantExpr {
  type: ExprType.Constant
  value: number
}

function constant(value: number): ConstantExpr {
  return { type: ExprType.Constant, value }
}

export interface ParamExpr {
  type: ExprType.Param
  param: t.Param
}

type BinaryOp = "+" | "*" | "pow"

export interface BinaryExpr {
  type: ExprType.Binary
  op: BinaryOp
  l: Expr
  r: Expr
  reused: boolean
}

function binary(op: BinaryOp, l: Expr, r: Expr): BinaryExpr {
  return { type: ExprType.Binary, op, l, r, reused: false }
}

export interface UnaryExpr {
  type: ExprType.Unary
  operand: Expr
  fn: t.UnaryFn
  reused: boolean
}

function unary(fn: t.UnaryFn, operand: Expr): UnaryExpr {
  return { type: ExprType.Unary, fn, operand, reused: false }
}

export interface PrecomputedExpr {
  type: ExprType.Precomputed
  exp: CacheableExpr
}

function precomputed(exp: CacheableExpr): PrecomputedExpr {
  return { type: ExprType.Precomputed, exp }
}

export interface Module {
  loss: Expr
  gradient: Map<t.Param, Expr>
}

export function module(loss: Loss) {
  const cacheable = new Map<t.Num, CacheableExpr>()

  function visitNum(num: t.Num): Expr {
    if (num.type === t.NumType.Constant) {
      return constant(num.value)
    } else if (num.type === t.NumType.Param) {
      return { type: ExprType.Param, param: num }
    }

    if (cacheable.has(num)) {
      const store = checkNotNull(cacheable.get(num))
      store.reused = true
      return precomputed(store)
    }

    let exp: CacheableExpr
    switch (num.type) {
      case t.NumType.Sum:
        exp = binary("+", visitSumTerm(num.firstTerm), constant(num.k))
        break
      case t.NumType.Product:
        exp = visitProductTerm(num.firstTerm)
        break
      case t.NumType.Unary:
        exp = unary(num.fn, visitNum(num.term))
        break
    }
    cacheable.set(num, exp)
    return exp
  }

  function visitSumTerm(node: t.TermNode<t.SumTerm>): BinaryExpr {
    let result = binary("*", constant(node.a), visitNum(node.x))
    if (node.nextTerm) result = binary("+", result, visitSumTerm(node.nextTerm))
    return result
  }

  function visitProductTerm(node: t.TermNode<t.ProductTerm>): BinaryExpr {
    let result = binary("pow", visitNum(node.x), constant(node.a))
    if (node.nextTerm)
      result = binary("*", result, visitProductTerm(node.nextTerm))
    return result
  }

  return {
    loss: visitNum(loss.value),
    gradient: new Map(
      Array.from(loss.gradient.elements).map(([p, num]) => [p, visitNum(num)]),
    ),
  }
}
