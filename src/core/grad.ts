import * as t from "./types"
import * as c from "./construct"
import * as n from "./num"
import { assertUnreachable } from "./assert"

export interface Gradient {
  elements: Map<t.Param, t.Num>
}

export function gradient(output: t.Num): Gradient {
  const diffs = new Map<t.Num, CompoundDiff>()
  const params = new Set<t.Param>()

  function diff(num: t.Num): CompoundDiff {
    const res = diffs.get(num)
    if (res) return res
    else {
      const cd: CompoundDiff = {
        type: DiffType.Compound,
        parts: [],
      }
      diffs.set(num, cd)
      return cd
    }
  }

  diff(output).parts.push({
    type: DiffType.Constant,
    const: c.one,
  })

  const visited = new Set<t.Num>()
  function visit(num: t.Num) {
    if (!visited.has(num)) {
      visited.add(num)
      switch (num.type) {
        case t.NumType.Constant:
          break
        case t.NumType.Param:
          if (!num.fixed) params.add(num)
          break
        case t.NumType.Unary:
          diff(num.term).parts.push({
            type: DiffType.Unary,
            child: num,
            gradient: diff(num),
          })
          visit(num.term)
          break
        case t.NumType.Sum:
          visitSumTerm(num.firstTerm, diff(num))
          break
        case t.NumType.Product:
          visitProductTerm(num, num.firstTerm, diff(num))
          break
        default:
          assertUnreachable(num)
      }
    }
  }

  function visitSumTerm(term: t.TermNode<t.SumTerm>, gradient: Diff) {
    diff(term.x).parts.push({
      type: DiffType.Product,
      factor: term.a,
      gradient,
    })
    visit(term.x)
    if (term.nextTerm) visitSumTerm(term.nextTerm, gradient)
  }

  function visitProductTerm(
    num: t.Num,
    term: t.TermNode<t.ProductTerm>,
    gradient: Diff,
  ) {
    diff(term.x).parts.push({
      type: DiffType.Exponent,
      term: term.x,
      exponent: term.a,
      num,
      gradient,
    })
    visit(term.x)
    if (term.nextTerm) visitProductTerm(num, term.nextTerm, gradient)
  }
  visit(output)

  const elements = new Map<t.Param, t.Num>()
  params.forEach((p) => {
    elements.set(p, toNum(diff(p)))
  })
  return { elements }
}

type Diff = ConstantDiff | CompoundDiff | ProductDiff | ExponentDiff | UnaryDiff
enum DiffType {
  Constant,
  Compound,
  Product,
  Exponent,
  Unary,
}

interface ConstantDiff {
  type: DiffType.Constant
  const: t.Constant
  asNum?: t.Num
}

interface CompoundDiff {
  type: DiffType.Compound
  parts: Array<Diff>
  asNum?: t.Num
}

interface ProductDiff {
  type: DiffType.Product
  factor: number
  gradient: Diff
  asNum?: t.Num
}

interface ExponentDiff {
  type: DiffType.Exponent
  term: t.Num
  exponent: number
  gradient: Diff
  num: t.Num
  asNum?: t.Num
}

interface UnaryDiff {
  type: DiffType.Unary
  child: t.Unary
  gradient: Diff
  asNum?: t.Num
}

function toNum(d: Diff): t.Num {
  if (d.asNum == null) {
    d.asNum = computeNum(d)
  }
  return d.asNum
}

function computeNum(d: Diff): t.Num {
  switch (d.type) {
    case DiffType.Constant:
      return d.const
    case DiffType.Product:
      return n.mul(toNum(d.gradient), d.factor)
    case DiffType.Compound:
      let res: t.Num = c.zero
      d.parts.forEach((p) => {
        res = n.add(res, toNum(p))
      })
      return res
    case DiffType.Exponent:
      return n.mul(
        n.mul(toNum(d.gradient), n.div(d.num, n.pow(d.term, d.exponent))),
        n.mul(n.pow(d.term, d.exponent - 1), d.exponent),
      )
    case DiffType.Unary:
      switch (d.child.fn) {
        case "sign":
          return c.zero
        case "abs":
          return n.mul(toNum(d.gradient), n.sign(d.child.term))
        case "sin":
          return n.mul(toNum(d.gradient), n.cos(d.child.term))
        case "cos":
          return n.mul(toNum(d.gradient), n.neg(n.sin(d.child.term)))
        case "atan":
          return n.div(toNum(d.gradient), n.add(c.one, n.pow(d.child.term, 2)))
        case "log":
          return n.mul(toNum(d.gradient), n.div(c.one, d.child.term))
        case "exp":
          return n.mul(toNum(d.gradient), d.child)
      }
  }
}
