import * as t from './types'
import * as o from './bounds'
import { cacheNum } from './cache'

let id = 0
function nextID() {
    id += 1
    return id
}

export function nodeCount() {
    return id
}

export function param(name: string, value: number = 1): t.Param {
    return { type: t.NumType.Param, id: nextID(), name, value, bounds: o.Unbounded }
}

export function nonNegativeParam(name: string, value: number = 1): t.Param {
    return { type: t.NumType.Param, id: nextID(), name, value, bounds: o.NonNegativeBounds }
}

export function constant(n: number): t.Constant {
    const bounds = o.constantBounds(n)
    return { type: t.NumType.Constant, value: n, bounds }
}

export const one = constant(1)
export const zero = constant(0)
export const negOne = constant(-1)

export type OptNode<T extends t.Term> = t.TermNode<T> | null

export function termNode<T extends t.Term>(a: number, x: T, nextTerm: OptNode<T>): OptNode<T> {
    if (a == 0)
        return nextTerm

    return {x, a, nextTerm}
}

export function sumNode(x: t.SumTerm): t.TermNode<t.SumTerm> {
    return {x, a: 1, nextTerm: null}
}

function sumTermBounds(firstTerm: t.TermNode<t.SumTerm>): o.Bounds {
    const bounds = o.mul(firstTerm.x.bounds, o.constantBounds(firstTerm.a))
    if(firstTerm.nextTerm == null)
        return bounds
    else
        return o.add(bounds, sumTermBounds(firstTerm.nextTerm))
}

function sumBounds(k: number, firstTerm: t.TermNode<t.SumTerm>): o.Bounds {
    return o.add(o.constantBounds(k), sumTermBounds(firstTerm))
}

export function sum(k: number, firstTerm: OptNode<t.SumTerm>): t.Num {
    if (firstTerm == null)
        return constant(k)

    if (k == 0) {
        if (firstTerm.a == 1 && firstTerm.nextTerm == null)
            return firstTerm.x
    }

    const bounds = sumBounds(k, firstTerm)

    return cacheNum({
        type: t.NumType.Sum,
        id: nextID(),
        k, firstTerm, bounds
    })
}


export function productNode(x: t.ProductTerm): t.TermNode<t.ProductTerm> {
    return {x, a: 1, nextTerm: null}
}

function productBounds(firstTerm: t.TermNode<t.ProductTerm>): o.Bounds {
    const bounds = o.pow(firstTerm.x.bounds, o.constantBounds(firstTerm.a))
    if(firstTerm.nextTerm == null)
        return bounds
    else
        return o.mul(bounds, productBounds(firstTerm.nextTerm))
}

export function product(firstTerm: OptNode<t.ProductTerm>): t.Num {
    if (firstTerm == null)
        return constant(1)

    if (firstTerm.a == 1 && firstTerm.nextTerm == null)
        return firstTerm.x

    const bounds = productBounds(firstTerm)

    return cacheNum({
        type: t.NumType.Product,
        id: nextID(),
        firstTerm, bounds
    })
}

export function unary(term: t.Term, fn: t.UnaryFn, bounds: o.Bounds): t.Unary {
    return cacheNum({
        type: t.NumType.Unary,
        id: nextID(),
        term, bounds, fn
    })
}
