import * as k from "../core/api"

import {Variable} from './variable'
import {Node} from './node'
import {Constraint} from './constraint'
import {View} from './view'

export interface Model {
    variables: Variable[]
    constraints: Constraint[]
    nodes: Node[]
    views: View[]
    ev: k.Evaluator
}

export function emptyModel() {
    return {
        variables: [],
        constraints: [],
        nodes: [],
        views: [],
        ev: k.evaluator(new Map())
    }
}

export function cloneModel(m: Model): Model {
    return {
        variables: m.variables.slice(),
        constraints: m.constraints.slice(),
        nodes: m.nodes.slice(),
        views: m.views.slice(),
        ev: k.evaluator(m.ev.params)
    }
}

let oldLoss: k.Num = k.zero
let optimizer: k.Optimizer | undefined = undefined

export function optimize(m: Model, iterations: number, opts: k.OptimizeOptions): Model {
    const loss = computeLoss(m)
    if(!optimizer || loss !== oldLoss) {
        optimizer = k.optimizer(loss, m.ev.params)
        oldLoss = loss
    }

    const ev = optimizer.optimize(iterations, new Map(), opts)
    const newModel = cloneModel(m)
    newModel.ev = ev
    return newModel
}

function computeLoss(m: Model): k.Num {
    return k.zero
}