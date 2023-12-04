import * as t from "./types"
import * as o from "./bounds"
import { cacheNum } from "./cache"

let id = 0
function nextID() {
  id += 1
  return id
}

export function nodeCount() {
  return id
}

export function param(name: string): t.Param {
  return {
    type: t.NumType.Param,
    id: nextID(),
    name,
    bounds: o.Unbounded,
    fixed: false,
  }
}

export function observation(name: string): t.Param {
  return {
    type: t.NumType.Param,
    id: nextID(),
    name,
    bounds: o.Unbounded,
    fixed: true,
  }
}

export function constant(n: number): t.Constant {
  const bounds = o.constantBounds(n)
  return { type: t.NumType.Constant, value: n, bounds }
}

export const one = constant(1)
export const zero = constant(0)
export const negOne = constant(-1)

function sumTermBounds(terms: t.Terms<t.SumTerm>): o.Bounds {
  const bounds = o.mul(firstTerm.x.bounds, o.constantBounds(firstTerm.a))
  if (firstTerm.nextTerm == null) return bounds
  else return o.add(bounds, sumTermBounds(firstTerm.nextTerm))
}

function sumBounds(k: number, terms: t.Terms<t.SumTerm>): o.Bounds {
  return o.add(o.constantBounds(k), sumTermBounds(terms))
}

export function sumTerms(x: t.SumTerm): Map<t.SumTerm, number> {
  const terms = new Map<t.SumTerm, number>()
  terms.set(x, 1)
  return terms
}

export function sum(k: number, terms: t.Terms<t.SumTerm>): t.Num {
  if (firstTerm == null) return constant(k)

  if (k == 0) {
    if (firstTerm.a == 1 && firstTerm.nextTerm == null) return firstTerm.x
  }

  const bounds = sumBounds(k, firstTerm)

  return cacheNum({
    type: t.NumType.Sum,
    k,
    firstTerm,
    bounds,
  })
}

function productBounds(terms: t.Terms<t.ProductTerm>): o.Bounds {
  const bounds = o.pow(firstTerm.x.bounds, o.constantBounds(firstTerm.a))
  if (firstTerm.nextTerm == null) return bounds
  else return o.mul(bounds, productBounds(firstTerm.nextTerm))
}

export function productTerms(x: t.ProductTerm): t.Terms<t.ProductTerm> {
  const terms = new Map<t.ProductTerm, number>()
  terms.set(x, 1)
  return terms
}

export function product(terms: t.Terms<t.ProductTerm>): t.Num {
  if (terms.size == 0) return constant(1)

  //TODO
  //if (firstTerm.a == 1 && firstTerm.nextTerm == null) return firstTerm.x

  const bounds = productBounds(terms)

  return cacheNum({
    type: t.NumType.Product,
    terms,
    bounds,
  })
}

export function unary(term: t.Term, fn: t.UnaryFn, bounds: o.Bounds): t.Unary {
  return cacheNum({
    type: t.NumType.Unary,
    term,
    bounds,
    fn,
  })
}
