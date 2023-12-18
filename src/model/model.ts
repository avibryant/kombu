import * as k from "../core/api"

import { Node } from "./node"
import { Constraint, constraint } from "./constraint"
import { View } from "./view"
import { Point } from "./point"
import { Angle } from "./angle"
import { Distribution, normal } from "./distribution"

export interface Model {
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
    ev: k.evaluator(new Map()),
  }
}

export function cloneModel(m: Model): Model {
  return {
    constraints: m.constraints.slice(),
    nodes: m.nodes.slice(),
    views: m.views.slice(),
    ev: k.evaluator(m.ev.params),
  }
}

export function node(m: Model, pt: Point): Node {
  const n: Node = {
    point: pt,
  }
  m.nodes.push(n)
  return n
}

export function someLength(
  m: Model,
  name: string,
  hint: k.AnyNum = 100,
): k.Num {
  const param = k.param(name)
  const value = k.mul(hint, k.abs(param))
  m.constraints.push(constraint(name, normal(hint, 20), value))
  return value
}

export function someAngle(m: Model, name: string): Angle {
  const p = k.param(name)
  m.constraints.push(constraint(name, normal(0, 2), p))
  const a = k.logistic(p)
  const cos = k.sub(k.mul(a, 2), 1)
  const sin = k.sqrt(k.sub(1, k.mul(cos, cos)))
  return { cos, sin }
}

export function constrain(
  name: string,
  m: Model,
  dist: Distribution,
  value: k.Num,
) {
  const c = constraint(name, dist, value)
  m.constraints.push(c)
}

let oldLoss: k.Num = k.zero
let optimizer: k.Optimizer | undefined = undefined

export function optimize(
  m: Model,
  iterations: number,
  opts: k.OptimizeOptions,
): Model {
  const lossValue = totalLoss(m)
  if (!optimizer || lossValue !== oldLoss) {
    const loss = k.loss(lossValue)
    optimizer = k.optimizer(loss, m.ev.params)
    oldLoss = lossValue
  }

  const ev = optimizer.optimize(iterations, new Map(), opts)
  const newModel = cloneModel(m)
  newModel.ev = ev
  return newModel
}

export function totalLoss(m: Model): k.Num {
  const conLoss = m.constraints.map((v) => v.logP)
  return conLoss.reduce(k.add)
}
