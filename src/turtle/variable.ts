import * as t from '../core/types'
import * as c from '../core/construct'
import {Evaluator} from '../core/eval'

export abstract class Variable {
    name: string
    units: string
    param: t.Param
    value: t.Num

    constructor(name: string, units: string) {
        this.name = name
        this.units = units
        this.param = c.param(name)
        this.value = this.transform(this.param)
    }

    abstract transform(param: t.Param): t.Num
    abstract logProb(y: t.Num): t.Num

    abstract display(ev: Evaluator): number
    abstract inverse(y: number): number

    abstract min(): number
    abstract max(): number
}