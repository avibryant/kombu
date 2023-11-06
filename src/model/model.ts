import * as k from "../core/api"

import { Node } from "./node"
import { Constraint, constraint } from "./constraint"
import { View } from "./view"
import { Point } from "./point"
import { Angle } from "./angle"
import { Distribution, normal, laplace } from "./distribution"

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
  m.constraints.push(constraint(normal(hint, 20), value))
  return value
}

export function someAngle(m: Model, name: string): Angle {
  const a = k.param(name)
  const b = k.param(name)
  const n = k.sqrt(k.add(k.mul(a, a), k.mul(b, b)))
  const cos = k.div(a, n)
  const sin = k.div(b, n)
  m.constraints.push(constraint(laplace(0, 2), a))
  m.constraints.push(constraint(laplace(0, 2), b))
  return { cos, sin }
}

export function constrain(m: Model, dist: Distribution, value: k.Num) {
  const c = constraint(dist, value)
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
