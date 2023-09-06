import * as t from './types'
import { Bounds } from './bounds'

export function printNum(n: t.Num): String {
    const buf = []
    printNumBuf(n, buf)
    printBoundsBuf(n.bounds, buf)
    return buf.join(" ")
}

function printNumBuf(n: t.Num, buf: String[]) {
    switch (n.type) {
        case t.NumType.Param:
            buf.push(n.name)
            break
        case t.NumType.Constant:
            buf.push(n.value.toString())
            break
        case t.NumType.Sum:
            buf.push("(")
            printSumBuf(n.firstTerm, buf)
            if (n.k != 0) {
                buf.push("+")
                buf.push(n.k.toString())
            }
            buf.push(")")
            break
        case t.NumType.Product:
            buf.push("(")
            printProductBuf(n.firstTerm, buf)
            buf.push(")")
            break
        case t.NumType.Unary:
            buf.push(n.fn + "(")
            printNumBuf(n.term, buf)
            buf.push(")")
            break
    }
}

function printSumBuf(node: t.TermNode<t.SumTerm>, buf: String[]) {
    if (node.a != 1) {
        buf.push(node.a.toString())
        buf.push("*")
    }

    printNumBuf(node.x, buf)
    if (node.nextTerm) {
        buf.push("+")
        printSumBuf(node.nextTerm, buf)
    }
}

function printProductBuf(node: t.TermNode<t.ProductTerm>, buf: String[]) {
    printNumBuf(node.x, buf)
    if (node.a != 1) {
        buf.push("^")
        buf.push(node.a.toString())
    }

    if (node.nextTerm) {
        buf.push("*")
        printProductBuf(node.nextTerm, buf)
    }
}

function printBoundsBuf(b: Bounds, buf: String[]) {
    if (!b) {
        buf.push("{undefined}")
        return
    }

    if (b.lower == -Infinity && b.upper == Infinity)
        return

    if(b.lower == b.upper)
        return

    buf.push("{")
    if (b.lower != -Infinity) {
        buf.push(b.lower.toString())
        buf.push("<=")
    }
    buf.push("_")
    if (b.upper != Infinity) {
        buf.push("<=")
        buf.push(b.upper.toString())
    }
    buf.push("}")
}