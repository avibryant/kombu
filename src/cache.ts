import * as t from './types'

//use WeakRef, GC op that deletes expired refs
const map = new Map<string,t.Num>()
export function cacheNum<T extends t.Num>(n: T): T {
    const sig = signature(n)
    let res = map.get(sig)
    if(res == undefined) {
        map.set(sig, n)
        res = n
    }
    return <T>res
}

function signature(n: t.Num): string {
    const buf: string[] = []
    switch(n.type) {
        case t.NumType.Constant:
            buf.push(n.value.toString())
            break
        case t.NumType.Param:
            buf.push("param")
            buf.push(n.id.toString())
            break
        case t.NumType.Unary:
            buf.push(n.fn)
            buf.push(n.term.id.toString())
            break
        case t.NumType.Product:
            buf.push("product")
            terms(buf, n.firstTerm)
            break
        case t.NumType.Sum:
            buf.push("sum")
            buf.push(n.k.toString())
            terms(buf, n.firstTerm)
            break
    }
    return buf.join(":")
}

function terms<T extends t.ProductTerm | t.SumTerm>(buf: string[], node: t.TermNode<T>) {
    buf.push(node.a.toString())
    buf.push(node.x.id.toString())
    if(node.nextTerm) {
        terms(buf, node.nextTerm)
    }
}