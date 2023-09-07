import * as t from './types'
import { Bounds } from './bounds'

export function printNum(n: t.Num): String {
    const buf = []
    printNumBuf(n, buf)
    printBoundsBuf(n.bounds, buf)
    return buf.join(" ")
}

interface XA {
    x: t.Num
    a: number
}

function printNumBuf(n: t.Num, buf: String[], parens: boolean = false) {
    const pos: Array<XA> = []
    const neg: Array<XA> = []
    switch (n.type) {
        case t.NumType.Param:
            buf.push(n.name)
            break
        case t.NumType.Constant:
            buf.push(n.value.toString())
            break
        case t.NumType.Sum:
            splitNodes(n.firstTerm, pos, neg)
            let count = pos.length + neg.length
            if(n.k != 0)
                count += 1
            if(parens && count > 1)
                buf.push("(")

            const first = pos.shift()
            if(first) {
                if(first.a != 1)
                    buf.push(first.a.toString())
                printNumBuf(first.x, buf)
            }
            printSumBuf(pos, "+", buf)
            printSumBuf(neg, "-", buf)

            if (n.k > 0) {
                buf.push("+")
                buf.push(n.k.toString())
            } else if(n.k < 0) {
                buf.push("-")
                buf.push((n.k * -1).toString())
            }
            if(parens && count > 1)
                buf.push(")")
            break
        case t.NumType.Product:
            splitNodes(n.firstTerm, pos, neg)
            if(neg.length == 0)
                printProductBuf(pos, buf)
            else {
                buf.push("\\frac{")
                if(pos.length == 0)
                    buf.push("1")
                else
                    printProductBuf(pos, buf)
                buf.push("}{")
                printProductBuf(neg, buf)
                buf.push("}")
            }
            break
        case t.NumType.Unary:
            buf.push(n.fn + "(")
            printNumBuf(n.term, buf)
            buf.push(")")
            break
    }
}

function splitNodes<T extends t.ProductTerm | t.SumTerm>(
    node: t.TermNode<T>, pos: Array<XA>, neg: Array<XA>) {
        if(node.a > 0)
            pos.push({x: node.x, a: node.a})
        else
            neg.push({x: node.x, a: node.a * -1})
        if(node.nextTerm)
            splitNodes(node.nextTerm, pos, neg)
}

function printSumBuf(xa: Array<XA>, op: String, buf: String[]) {
    xa.forEach((node) => {
        buf.push(op)
        if (node.a != 1) {
            buf.push(node.a.toString())
        }

        printNumBuf(node.x, buf)
    })
}

function printProductBuf(xa: Array<XA>, buf: String[]) {
    xa.forEach((node) => {
        if (node.a > 1) {
            printNumBuf(node.x, buf, true)
            buf.push("^{")
            buf.push(node.a.toString())
            buf.push("}")
        } else if(node.a < 1) {
            const m = 1 / node.a
            buf.push("\\sqrt")
            if(m != 2) {
                buf.push("[")
                buf.push(m.toString())
                buf.push("]")
            }
            buf.push("{")
            printNumBuf(node.x, buf)
            buf.push("}")
        } else {
            printNumBuf(node.x, buf, true)
        }
    })
}

function printBoundsBuf(b: Bounds, buf: String[]) {
    if (b.lower == -Infinity && b.upper == Infinity)
        return

    if(b.lower == b.upper)
        return

    buf.push("\\in \\{")
    if (b.lower != -Infinity) {
        buf.push(b.lower.toString())
    }
    buf.push("\\dots")
    if (b.upper != Infinity) {
        buf.push(b.upper.toString())
    }
    buf.push("\\}")
}