import * as t from './types'
import * as c from './construct'
import * as u from './unary'

export function addNumNum(u: t.Num, v: t.Num): t.Num {
    switch (u.type) {
        case t.NumType.Constant:
            switch (v.type) {
                case t.NumType.Constant:
                    return addConstantConstant(u, v)
                case t.NumType.Param:
                case t.NumType.Product:
                case t.NumType.Unary:
                    return addConstantVariable(u, v)
                case t.NumType.Sum:
                    return addConstantSum(u, v)
            }
            break
        case t.NumType.Param:
        case t.NumType.Product:
        case t.NumType.Unary:
            switch (v.type) {
                case t.NumType.Constant:
                    return addConstantVariable(v, u)
                case t.NumType.Param:
                case t.NumType.Product:
                case t.NumType.Unary:
                    return addVariableVariable(u, v)
                case t.NumType.Sum:
                    return addVariableSum(u, v)
            }
            break
        case t.NumType.Sum:
            switch (v.type) {
                case t.NumType.Constant:
                    return addConstantSum(v, u)
                case t.NumType.Param:
                case t.NumType.Product:
                case t.NumType.Unary:
                    return addVariableSum(v, u)
                case t.NumType.Sum:
                    return addSumSum(u, v)
            }
            break
    }
}

function addConstantConstant(u: t.Constant, v: t.Constant): t.Constant {
    return c.constant(u.value + v.value)
}

function addConstantVariable(u: t.Constant, v: t.SumTerm): t.Num {
    return c.sum(u.value, c.sumNode(v))
}

function addVariableVariable(u: t.SumTerm, v: t.SumTerm): t.Num {
    return c.sum(0, mergeNodes(c.sumNode(u), c.sumNode(v)))
}

function addConstantSum(u: t.Constant, v: t.Sum): t.Num {
    return c.sum(u.value + v.k, v.firstTerm)
}

function addVariableSum(u: t.SumTerm, v: t.Sum): t.Num {
    return c.sum(v.k, mergeNodes(c.sumNode(u), v.firstTerm))
}

function addSumSum(u: t.Sum, v: t.Sum): t.Num {
    const k = u.k + v.k
    const firstTerm = mergeNodes(u.firstTerm, v.firstTerm)
    return c.sum(k, firstTerm)
}

export function mulNumNum(u: t.Num, v: t.Num): t.Num {
    switch (u.type) {
        case t.NumType.Constant:
            switch (v.type) {
                case t.NumType.Constant:
                    return mulConstantConstant(u, v)
                case t.NumType.Param:
                case t.NumType.Sum:
                case t.NumType.Product:
                case t.NumType.Unary:
                    return mulConstantVariable(u, v)
            }
            break
        case t.NumType.Param:
        case t.NumType.Sum:
        case t.NumType.Unary:
            switch (v.type) {
                case t.NumType.Constant:
                    return mulConstantVariable(v, u)
                case t.NumType.Param:
                case t.NumType.Sum:
                case t.NumType.Unary:
                    return mulVariableVariable(u, v)
                case t.NumType.Product:
                    return mulVariableProduct(u, v)
            }
            break
        case t.NumType.Product:
            switch (v.type) {
                case t.NumType.Constant:
                    return mulConstantVariable(v, u)
                case t.NumType.Param:
                case t.NumType.Sum:
                case t.NumType.Unary:
                    return mulVariableProduct(v, u)
                case t.NumType.Product:
                    return mulProductProduct(u, v)
            }
            break
    }
}

function mulConstantConstant(u: t.Constant, v: t.Constant): t.Constant {
    return c.constant(u.value * v.value)
}

function mulConstantVariable(u: t.Constant, v: t.SumTerm | t.Sum): t.Num {
    if (v.type == t.NumType.Sum) {
        return c.sum(v.k * u.value, mulA(v.firstTerm, u.value))
    } else {
        return c.sum(0, c.termNode(u.value, v, null))
    }
}

function mulVariableVariable(u: t.ProductTerm, v: t.ProductTerm): t.Num {
    return c.product(mergeNodes(c.productNode(u), c.productNode(v)))
}

function mulVariableProduct(u: t.ProductTerm, v: t.Product): t.Num {
    return c.product(mergeNodes(c.productNode(u), v.firstTerm))
}

function mulProductProduct(u: t.Product, v: t.Product): t.Num {
    return c.product(mergeNodes(u.firstTerm, v.firstTerm))
}

export function powNum(x: t.Num, a: number): t.Num {
    switch (x.type) {
        case t.NumType.Constant:
            return powConstant(x, a)
        case t.NumType.Param:
        case t.NumType.Sum:
        case t.NumType.Unary:
            return powVariable(x, a)
        case t.NumType.Product:
            return powProduct(x, a)
    }
}

function powConstant(x: t.Constant, a: number): t.Constant {
    return c.constant(Math.pow(x.value, a))
}

function powVariable(x: t.ProductTerm, a: number): t.Num {
    return c.product(c.termNode(a, x, null))
}

function powProduct(u: t.Product, a: number): t.Num {
    return c.product(mulProductA(u.firstTerm, a))
}

function mulA<T extends t.Term>(node: t.TermNode<T>, a: number): c.OptNode<T> {
    const nextTerm = node.nextTerm ? mulA(node.nextTerm, a) : null
    const newA = node.a * a
    if (newA == 0)
        return nextTerm
    else
        return c.termNode(newA, node.x, nextTerm)
}

function mulProductA(node: t.TermNode<t.ProductTerm>, a: number): c.OptNode<t.ProductTerm> {
    const nextTerm = node.nextTerm ? mulProductA(node.nextTerm, a) : null
    const newA = node.a * a
    let newX = node.x

    if((node.a % 2) == 0 && (newA % 2 != 0))
        newX = u.absTerm(newX)
    
    if (newA == 0)
        return nextTerm
    else
        return c.termNode(newA, newX, nextTerm)
}


function addA<T extends t.Term>(node: t.TermNode<T>, a: number): c.OptNode<T> {
    const newA = node.a + a
    if (newA == 0)
        return node.nextTerm
    else
        return c.termNode(newA, node.x, node.nextTerm)
}

function mergeNodes<T extends t.Term>(u: c.OptNode<T>, v: c.OptNode<T>): c.OptNode<T> {
    if (u == null) {
        return v
    } else if (v == null) {
        return u
    } else {
        if (u.x == v.x) {
            const newV = addA(v, u.a)
            return mergeNodes(u.nextTerm, newV)
        }

        if (u.x.id > v.x.id) {
            const newV = mergeNodes(u.nextTerm, v)
            return c.termNode(u.a, u.x, newV)
        } else {
            const newU = mergeNodes(u, v.nextTerm)
            return c.termNode(v.a, v.x, newU)
        }
    }
}
