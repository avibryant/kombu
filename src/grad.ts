import * as t from './types'
import * as c from './construct'
import * as n from './num'

export function gradient(output: t.Num): Map<t.Param,t.Num> {
    const diffs = new Map<t.Num, CompoundDiff>()
    const params = new Set<t.Param>()
    
    function diff(num: t.Num): CompoundDiff {
        const res = diffs.get(num)
        if (res)
            return res
        else {
            const cd: CompoundDiff = {
                type: DiffType.Compound,
                parts: []
            }
            diffs.set(num, cd)
            return cd
        }
    }

    diff(output).parts.push({
        type: DiffType.Constant,
        const: c.one
    })

    const visited = new Set<t.Num>()
    function visit(num: t.Num) {
        if (!visited.has(num)) {
            visited.add(num)
            switch (num.type) {
                case t.NumType.Constant:
                    break
                case t.NumType.Param:
                    params.add(num)
                    break
                case t.NumType.Unary:
                    diff(num.term).parts.push({
                        type: DiffType.Unary,
                        child: num,
                        gradient: diff(num)
                    })
                    visit(num.term)
                    break
                case t.NumType.Sum:
                    visitSumTerm(num.firstTerm, diff(num))
                    break
                case t.NumType.Product:
                    visitProductTerm(num.firstTerm, diff(num))
                    break
            }

        }
    }

    function visitSumTerm(term: t.TermNode<t.SumTerm>, gradient: Diff) {
        diff(term.x).parts.push({
            type: DiffType.Product,
            factor: term.a,
            gradient
        })
        visit(term.x)
        if (term.nextTerm)
            visitSumTerm(term.nextTerm, gradient)
    }

    function visitProductTerm(term: t.TermNode<t.ProductTerm>, gradient: Diff) {
        diff(term.x).parts.push({
            type: DiffType.Exponent,
            term: term.x,
            exponent: term.a,
            gradient
        })
        visit(term.x)
        if (term.nextTerm)
            visitProductTerm(term.nextTerm, gradient)
    }
    visit(output)

    const g = new Map<t.Param, t.Num>()
    params.forEach((p) => {
        g.set(p, toNum(diff(p)))
    })
    return g
}


type Diff = ConstantDiff | CompoundDiff | ProductDiff | ExponentDiff | UnaryDiff
enum DiffType { Constant, Compound, Product, Exponent, Unary }

interface ConstantDiff {
    type: DiffType.Constant
    const: t.Constant
}

interface CompoundDiff {
    type: DiffType.Compound
    parts: Array<Diff>
}

interface ProductDiff {
    type: DiffType.Product
    factor: number
    gradient: Diff
}

interface ExponentDiff {
    type: DiffType.Exponent
    term: t.Num,
    exponent: number,
    gradient: Diff
}

interface UnaryDiff {
    type: DiffType.Unary
    child: t.Unary
    gradient: Diff
}


function toNum(d: Diff): t.Num {
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
                toNum(d.gradient),
                n.mul(
                    n.pow(d.term, d.exponent - 1),
                    d.exponent))
        case DiffType.Unary:
            switch (d.child.fn) {
                case "sign":
                    return c.zero
                case "abs":
                    return n.mul(
                        toNum(d.gradient),
                        n.sign(d.child.term))
            }
    }
}