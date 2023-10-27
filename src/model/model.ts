import * as k from "../core/api"

import { Variable, lengthVariable, angleVariable } from "./variable"
import { Node } from "./node"
import { Constraint, constraint, increase, decrease } from "./constraint"
import { View } from "./view"
import { Point } from "./point"
import { Angle, fromSin } from "./angle"

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

export function someLength(m: Model, name: string, hint?: k.AnyNum): k.Num {
  const variable = lengthVariable(name, hint ? k.num(hint) : undefined)
  m.variables.push(variable)
  return variable.value
}

export function someAngle(m: Model, name: string): Angle {
  const variable = angleVariable(name)
  m.variables.push(variable)
  return fromSin(variable.value)
}

export function constrain(
  m: Model,
  a: Node,
  b: Node,
  distance: number,
  sd: number,
  keys?: { up: string; down: string },
) {
  const c = constraint(a, b, distance, sd, keys)
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
  const varLoss = m.variables.map((v) => v.loss)
  const conLoss = m.constraints.map((v) => v.loss)
  return varLoss.concat(conLoss).reduce(k.add)
}

export function keyDown(m: Model, key: string) {
  m.constraints.forEach((c) => {
    if (c.keys && c.keys.up == key) increase(c)
    else if (c.keys && c.keys.down == key) decrease(c)
  })
}
