import * as k from '../core/api'

export interface Variable {
    type: "length" | "angle"
    param: k.Param
    value: k.Num
    loss: k.Num
    init?: k.Num
}

interface AngleVariable extends Variable {
    type: "angle"
}

interface LengthVariable extends Variable {
    type: "length"
}

export function lengthVariable(name: string, init?: k.Num): LengthVariable {
    const param = k.param(name)
    let value = k.exp(param)
    if(init)
        value = k.mul(value, init)
    else
        value = k.mul(value, 100)

    const loss = k.div(k.mul(param, param), 2)
    return {
        type: "length",
        param, value, init, loss
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
