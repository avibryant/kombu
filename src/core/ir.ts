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

type BinaryOp = "+" | "-" | "*" | "/" | "pow"

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

function isConstant(exp: Expr): exp is ConstantExpr {
  return exp.type === ExprType.Constant
}

function isBinary(exp: Expr): exp is BinaryExpr {
  return exp.type === ExprType.Binary
}

function isConstVal(exp: Expr, value: number): boolean {
  return isConstant(exp) && (value === undefined || exp.value === value)
}

function plus(lhs: Expr, rhs: Expr) {
  if (isConstVal(lhs, 0)) return rhs
  if (isConstVal(rhs, 0)) return lhs

  // a + -b => a - b
  if (isConstant(rhs) && rhs.value < 0) {
    return binary("-", lhs, constant(rhs.value * -1))
  }

  // Note: `-a + b => b - a` is handled in construction-level simplification.

  // -ax + b => b - ax
  if (isBinary(lhs) && lhs.op === "*" && isConstant(lhs.l) && lhs.l.value < 0) {
    return binary("-", rhs, times(constant(lhs.l.value * -1), lhs.r))
  }

  // a + -xb => a - xb
  if (isBinary(rhs) && rhs.op === "*" && isConstant(rhs.l) && rhs.l.value < 0) {
    return binary("-", lhs, times(constant(rhs.l.value * -1), rhs.r))
  }

  return binary("+", lhs, rhs)
}

function times(lhs: Expr, rhs: Expr) {
  if (isConstVal(lhs, 1)) return rhs
  if (isConstVal(rhs, 1)) return lhs
  if (isConstVal(lhs, 0) || isConstVal(rhs, 0)) return constant(0)

  // u * v^-c => u / v^c
  if (
    isBinary(rhs) &&
    rhs.op === "pow" &&
    isConstant(rhs.r) &&
    rhs.r.value < 0
  ) {
    return binary("/", lhs, pow(rhs.l, rhs.r.value * -1))
  }

  return binary("*", lhs, rhs)
}

function pow(base: Expr, exponent: number) {
  switch (exponent) {
    case -1:
      return binary("/", constant(1), base)
    case 0:
      return constant(1)
    case 1:
      return base
    default:
      return binary("pow", base, constant(exponent))
  }
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

    let exp: Expr
    switch (num.type) {
      case t.NumType.Sum:
        exp = plus(visitSumTerm(num.firstTerm), constant(num.k))
        break
      case t.NumType.Product:
        exp = visitProductTerm(num.firstTerm)
        break
      case t.NumType.Unary:
        exp = unary(num.fn, visitNum(num.term))
        break
    }
    if (exp.type === ExprType.Binary || exp.type === ExprType.Unary) {
      cacheable.set(num, exp)
    }
    return exp
  }

  function visitSumTerm(node: t.TermNode<t.SumTerm>) {
    let result = times(constant(node.a), visitNum(node.x))
    if (node.nextTerm) result = plus(result, visitSumTerm(node.nextTerm))
    return result
  }

  function visitProductTerm(node: t.TermNode<t.ProductTerm>) {
    let result = pow(visitNum(node.x), node.a)
    if (node.nextTerm) result = times(result, visitProductTerm(node.nextTerm))
    return result
  }

  return {
    loss: visitNum(loss.value),
    gradient: new Map(
      Array.from(loss.gradient.elements).map(([p, num]) => [p, visitNum(num)]),
    ),
  }
}

export function lisp(node: Expr): string {
  let nextId = 0
  const varNames: Map<Expr, string> = new Map()
  const bindings: string[] = []

  function visitIrNode(node: Expr, forBinding = false): string {
    switch (node.type) {
      case ExprType.Constant:
        return node.value.toString()
      case ExprType.Precomputed:
        return visitReusedNode(node.exp)
      case ExprType.Param:
        return node.param.name
      case ExprType.Unary:
      case ExprType.Binary:
        if (node.reused && !forBinding) {
          return visitReusedNode(node)
        } else if (node.type === ExprType.Unary) {
          return `(${node.fn} ${visitIrNode(node.operand)})`
        } else {
          return `(${node.op} ${visitIrNode(node.l)} ${visitIrNode(node.r)})`
        }
    }
  }

  function visitReusedNode(node: CacheableExpr): string {
    if (!varNames.has(node)) {
      const name = `temp${nextId++}`
      bindings.push(`[${name} ${visitIrNode(node, true)}]`)
      varNames.set(node, name)
      return name
    }
    return checkNotNull(varNames.get(node))
  }

  const body = visitIrNode(node)
  if (bindings.length === 0) {
    return body
  }
  return `(let* (${bindings.join(" ")}) ${body})`
}

export function pseudocode(node: Expr): string {
  let nextId = 0
  const varNames: Map<Expr, string> = new Map()
  const bindings: string[] = []

  function visitIrNode(node: Expr, forBinding = false): string {
    switch (node.type) {
      case ExprType.Constant:
        return node.value.toString()
      case ExprType.Precomputed:
        return visitReusedNode(node.exp)
      case ExprType.Param:
        return node.param.name
      case ExprType.Unary:
      case ExprType.Binary:
        if (node.reused && !forBinding) {
          return visitReusedNode(node)
        } else if (node.type === ExprType.Unary) {
          return `${node.fn}(${visitIrNode(node.operand)})`
        } else if (node.op.length === 1) {
          return `${visitIrNode(node.l)} ${node.op} ${visitIrNode(node.r)}`
        } else if (node.op === "pow") {
          return `${visitIrNode(node.l)} ** ${visitIrNode(node.r)}`
        } else {
          return `${node.op}(${visitIrNode(node.l)}, ${visitIrNode(node.r)})`
        }
    }
  }

  function visitReusedNode(node: CacheableExpr): string {
    if (!varNames.has(node)) {
      const name = `temp${nextId++}`
      bindings.push(`${name} = ${visitIrNode(node, true)}`)
      varNames.set(node, name)
      return name
    }
    return checkNotNull(varNames.get(node))
  }

  const body = visitIrNode(node)
  if (bindings.length === 0) {
    return body
  }
  return `${bindings.join("\n")}\n${body}`
}
