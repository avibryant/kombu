import { assertUnreachable, checkNotNull } from "./assert"
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

export function constant(value: number): ConstantExpr {
  return { type: ExprType.Constant, value }
}

export interface ParamExpr {
  type: ExprType.Param
  param: t.Param
}

export function param(p: t.Param): ParamExpr {
  return { type: ExprType.Param, param: p }
}

type BinaryOp = "+" | "-" | "*" | "/" | "pow"

export interface BinaryExpr {
  type: ExprType.Binary
  op: BinaryOp
  l: Expr
  r: Expr
  reused: boolean
}

export function binary(op: BinaryOp, l: Expr, r: Expr): BinaryExpr {
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

  // -x + b => b - x
  if (
    isBinary(lhs) &&
    lhs.op === "*" &&
    isConstVal(lhs.l, -1) &&
    isConstant(rhs)
  ) {
    return binary("-", rhs, lhs.r)
  }

  // (0 - ax) + k => k - ax
  if (
    isBinary(lhs) &&
    lhs.op === "-" &&
    isConstVal(lhs.l, 0) &&
    isConstant(rhs)
  ) {
    return binary("-", rhs, lhs.r)
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
    case 0:
      return constant(1)
    case 1:
      return base
    default:
      return binary("pow", base, constant(exponent))
  }
}

type BinaryCtor = (l: Expr, r: Expr) => Expr

function termsToArray<T extends t.ProductTerm | t.SumTerm>(
  firstTerm: t.TermNode<T> | null,
) {
  const terms: t.TermNode<T>[] = []
  for (let term = firstTerm; term != null; term = term.nextTerm) {
    terms.push(term)
  }
  return terms
}

function combineTerms<T extends t.ProductTerm | t.SumTerm>(
  firstTerm: t.TermNode<T> | null,
  toExpr: (num: t.Num) => Expr,
  mul: BinaryCtor,
  add: BinaryCtor,
  sub: BinaryCtor,
  zero: () => Expr,
) {
  // TODO: Consider processing terms as a tree, not a chain.
  const terms = termsToArray(firstTerm)
  if (terms.length === 0) return zero()

  // If the first term is negative, try to avoid subtraction from 0.
  if (terms[0].a === -1) {
    const swapIdx = terms.findIndex((t) => t.a > 0)
    if (swapIdx > 0) {
      ;[terms[0], terms[swapIdx]] = [terms[swapIdx], terms[0]]
    }
  }
  return terms.reduce((acc: Expr, t: t.TermNode<T>) => {
    // Avoid a mul where possible.
    if (t.a === -1) {
      return sub(acc, toExpr(t.x))
    } else {
      return add(acc, mul(constant(t.a), toExpr(t.x)))
    }
  }, zero())
}

export function module(loss: Loss) {
  const cacheable = new Map<t.Num, CacheableExpr>()

  function visitNum(num: t.Num): Expr {
    if (num.type === t.NumType.Constant) {
      return constant(num.value)
    } else if (num.type === t.NumType.Param) {
      return param(num)
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
    const minus = (l: Expr, r: Expr) => binary("-", l, r)
    return combineTerms(node, visitNum, times, plus, minus, () => constant(0))
  }

  function visitProductTerm(node: t.TermNode<t.ProductTerm>) {
    let result = pow(visitNum(node.x), node.a)
    if (node.nextTerm) result = times(result, visitProductTerm(node.nextTerm))
    return result
  }

  return fixPrecomputedOrder({
    loss: visitNum(loss.value),
    gradient: new Map(
      Array.from(loss.gradient.elements).map(([p, num]) => [p, visitNum(num)]),
    ),
  })
}

// Ensure that for reused expressions, all of the Precomputed nodes come
// after the original expression in the in-order traversal of the tree.
function fixPrecomputedOrder(mod: Module): Module {
  const reused = new Set<CacheableExpr>()

  function visitExpr(exp: Expr): Expr {
    switch (exp.type) {
      case ExprType.Constant:
      case ExprType.Param:
        return exp
      case ExprType.Precomputed:
        exp = exp.exp
    }

    if (reused.has(exp)) return precomputed(exp)
    reused.add(exp)

    switch (exp.type) {
      case ExprType.Unary:
        exp.operand = visitExpr(exp.operand)
        break
      case ExprType.Binary:
        exp.l = visitExpr(exp.l)
        exp.r = visitExpr(exp.r)
        break
      default:
        assertUnreachable(exp)
    }
    return exp
  }

  return {
    loss: visitExpr(mod.loss),
    gradient: new Map(
      Array.from(mod.gradient).map(([p, exp]) => [p, visitExpr(exp)]),
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
          return `(${visitIrNode(node.l)} ${node.op} ${visitIrNode(node.r)})`
        } else if (node.op === "pow") {
          return `${visitIrNode(node.l)}^${visitIrNode(node.r)}`
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
