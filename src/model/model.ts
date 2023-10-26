import * as k from "../core/api"

import {Variable} from './variable'
import {Point} from './point'
import {Constraint} from './constraint'
import {View} from './view'

export interface Model {
    variables: Variable[]
    constraints: Constraint[]
    nodes: Node[]
    views: View[]
    params: Map<k.Param, number>
}

export interface Node {
    point: Point    
}

export function emptyModel() {
    return {
        variables: [],
        constraints: [],
        nodes: [],
        views: [],
        params: new Map()
    }
}

export function optimize(m: Model, iterations: number, opt: k.OptimizeOptions): Model {

}