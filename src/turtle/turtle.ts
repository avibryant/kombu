import * as k from "../core/api"

import * as pt from "../model/point"
import * as a from "../model/angle"
import { Model, node, constrain } from "../model/model"
import { segment } from "../model/view"
import { Node } from "../model/node"

export interface Turtle {
  position: Node
  direction: a.Angle
  penDown: boolean
  model: Model
}

export function turtle(model: Model): Turtle {
  return {
    position: node(model, pt.origin),
    direction: a.degrees(0),
    penDown: true,
    model,
  }
}

export function forward(t: Turtle, dist: k.AnyNum) {
  const v = pt.scale(a.vec(t.direction), dist)
  const to = node(t.model, pt.add(t.position.point, v))
  const view = segment(t.position, to, t.penDown)
  t.model.views.push(view)
  t.position = to
}

export function left(t: Turtle, angle: a.Angle) {
  t.direction = a.sub(t.direction, angle)
}

export function right(t: Turtle, angle: a.Angle) {
  t.direction = a.add(t.direction, angle)
}

export function penUp(t: Turtle) {
  t.penDown = false
}

export function penDown(t: Turtle) {
  t.penDown = true
}

export function at(t: Turtle, node: Node) {
  constrain(t.model, t.position, node, 0, 1)
}
