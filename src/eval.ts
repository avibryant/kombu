import * as t from './types'

let numCache = new Map<t.Num, number>()

export function clearCache() {
    numCache = new Map()
}

export function evaluate(num: t.Num): number {
    let result = numCache.get(num)
    if (result == undefined) {
        result = computeNum(num)
    }
    return result
}

function computeNum(num: t.Num): number {
    switch (num.type) {
        case t.NumType.Constant:
            return num.value
        case t.NumType.Param:
            return num.value
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
    if (node.nextTerm)
        result += evaluateSum(node.nextTerm)
    return result
}

function evaluateProduct(node: t.TermNode<t.ProductTerm>): number {
    let result = Math.pow(evaluate(node.x), node.a)
    if (node.nextTerm)
        result *= evaluateProduct(node.nextTerm)
    return result
}

function evaluateUnary(node: t.Term, type: t.UnaryFn): number {
    switch(type) {
        case "abs":
            return Math.abs(evaluate(node))
        case "sign":
            if(evaluate(node) >= 0)
                return 1
            else
                return -1
        case "cos":
            return Math.cos(evaluate(node))
        case "sin":
            return Math.sin(evaluate(node))
        case "tan":
            return Math.tan(evaluate(node))
        case "asin":
            return Math.asin(evaluate(node))
        case "acos":
            return Math.acos(evaluate(node))
        case "atan":
            return Math.atan(evaluate(node))
    }
}