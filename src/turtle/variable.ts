import * as t from '../core/types'
import {Evaluator} from '../core/eval'

export interface VariableDisplay {
    param: t.Param
    loss: number
    value: number
    min: number
    max: number
    units: string
    update: (y: number) => number 
}

export interface Variable {
    param: t.Param
    value: t.Num
    loss: t.Num
    display: (ev: Evaluator) => VariableDisplay
}
