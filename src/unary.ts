import * as t from './types'
import * as c from './construct'
import * as o from './bounds'

export function absNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant)
        return c.constant(Math.abs(x.value))
    else
        return absTerm(x)
}

export function absTerm<T extends t.ProductTerm | t.SumTerm>(x: T): T {
    if(x.bounds.lower >= 0.0)
        return x
    else
        return <T>c.unary(x, "abs", o.abs(x.bounds))
}

export function signNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant) {
        if(x.value > 0)
            return c.one
        else
            return c.negOne        
    } else {
        if(x.bounds.lower >= 0.0)
            return c.one
        else if(x.bounds.upper <= 0.0)
            return c.negOne
        else
            return c.unary(x, "sign", {lower: -1, upper: 1})
    }
}
