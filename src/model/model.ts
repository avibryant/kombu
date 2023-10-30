import * as k from "../core/api"

import { Variable, lengthVariable, angleVariable } from "./variable"
import { Node } from "./node"
import { Constraint, constraint } from "./constraint"
import { View } from "./view"
import { Point } from "./point"
import { Angle, fromCos } from "./angle"
import { Distribution, logNormal, normal } from "./distribution"

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
    ev: k.evaluator(new Map()),
  }
}

export function cloneModel(m: Model): Model {
  return {
    variables: m.variables.slice(),
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
  const variable = lengthVariable(name)
  m.variables.push(variable)
  m.constraints.push(constraint(logNormal(k.log(hint), 10), variable.value))
  return variable.value
}

export function someAngle(m: Model, name: string): Angle {
  const variable = angleVariable(name)
  m.variables.push(variable)
  m.constraints.push(constraint(normal(0, 2), variable.value))
  return fromCos(variable.value)
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
  const loss = totalLoss(m)
  if (!optimizer || loss !== oldLoss) {
    optimizer = k.optimizer(loss, m.ev.params)
    oldLoss = loss
  }

  const ev = optimizer.optimize(iterations, new Map(), opts)
  const newModel = cloneModel(m)
  newModel.ev = ev
  return newModel
}

export function totalLoss(m: Model): k.Num {
  const varLoss = m.variables.map((v) => v.logJ)
  const conLoss = m.constraints.map((v) => v.logP)
  return conLoss.concat(varLoss).reduce(k.add)
}
