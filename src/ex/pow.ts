import * as d from './dag'

export function powK(left: d.NotPowK, right: d.Constant): d.Num {
    if(right.value == 0)
        return d.constant(1)
    if(right.value == 1)
        return left
    return {
        type: "pow", left, right
    }
}