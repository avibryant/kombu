import * as t from './types'
import * as b from './binary'
import * as c from './construct'
import * as u from './unary'

export type AnyNum = t.Num | number

export function num(n: AnyNum): t.Num {
    if (typeof n == "number")
        return c.constant(n)
    else
        return n
}

export function add(u: AnyNum, v: AnyNum): t.Num {
    return b.addNumNum(num(u), num(v))
}

export function sub(u: AnyNum, v: AnyNum): t.Num {
    return add(u, mul(v, -1))
}

export function mul(u: AnyNum, v: AnyNum): t.Num {
    return b.mulNumNum(num(u), num(v))
}

export function div(u: AnyNum, v: AnyNum): t.Num {
    return mul(u, pow(v, -1))
}

export function pow(u: AnyNum, v: number): t.Num {
    return b.powNum(num(u), v)
}

export function sqrt(x: AnyNum): t.Num {
    return pow(x, 0.5)
}

export function neg(x: AnyNum): t.Num {
    return mul(x, -1)
}

export function abs(x: AnyNum): t.Num {
    return u.absNum(num(x))
}

export function sign(x: AnyNum): t.Num {
    return u.signNum(num(x))
}

export function cos(x: AnyNum): t.Num {
    return u.cosNum(num(x))
}

export function sin(x: AnyNum): t.Num {
    return u.sinNum(num(x))
}

export function atan(x: AnyNum): t.Num {
    return u.atanNum(num(x))
}