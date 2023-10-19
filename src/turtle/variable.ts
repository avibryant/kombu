import * as k from '../core/api'

export interface Variable {
    type: "length" | "angle"
    param: k.Param
    value: k.Num
    loss: k.Num
    hint?: k.Num
}

interface AngleVariable extends Variable {
    type: "angle"
}

interface LengthVariable extends Variable {
    type: "length"
}

export function lengthVariable(name: string, hint?: k.Num): LengthVariable {
    let mode = hint ? hint : k.num(100)
    const param = k.param(name)
    const value = k.exp(k.add(k.mul(param,3),k.log(mode)))
        //k.add(k.mul(param,20),mode)
    const loss = k.div(k.mul(param, param), 2)
    return {
        type: "length",
        param, value, hint, loss
    }
}

export function angleVariable(name: string): AngleVariable {
    const param = k.param(name)
    const loss = k.zero
    const value = k.sub(k.mul(2, k.logistic(param)), 1)

    return {
        type: "angle",
        param, value, loss
    }
}
