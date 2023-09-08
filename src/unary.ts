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

export function cosNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant)
        return c.constant(Math.cos(x.value))
    else {
        if(x.bounds.lower >= (Math.PI/2) && x.bounds.upper <= (Math.PI/2))
            return c.unary(x, "cos", {lower: 0, upper: 1})
        else    
            return c.unary(x, "cos", {lower: -1, upper: 1})
    }
}

export function sinNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant)
        return c.constant(Math.sin(x.value))
    else {
        if(x.bounds.lower == 0 && x.bounds.upper <= Math.PI)
            return c.unary(x, "sin", {lower: 0, upper: 1})
        else    
            return c.unary(x, "sin", {lower: -1, upper: 1})
    }
}

export function tanNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant)
        return c.constant(Math.tan(x.value))
    else {
        if(x.bounds.lower == 0 && x.bounds.upper <= (Math.PI/2))
            return c.unary(x, "tan", {lower: 0, upper: Infinity})
        else    
            return c.unary(x, "tan", o.Unbounded)
    }
}

export function acosNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant)
        return c.constant(Math.acos(x.value))
    else
        return c.unary(x, "acos", {lower: Math.acos(x.bounds.upper), upper: Math.acos(x.bounds.lower)})    
}

export function asinNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant)
        return c.constant(Math.asin(x.value))
    else
        return c.unary(x, "asin", {lower: Math.asin(x.bounds.lower), upper: Math.asin(x.bounds.upper)})        
}


export function atanNum(x: t.Num): t.Num {
    if(x.type == t.NumType.Constant)
        return c.constant(Math.atan(x.value))
    else
        return c.unary(x, "atan", {lower: Math.atan(x.bounds.lower), upper: Math.atan(x.bounds.upper)})        
}