import * as k from "../core/api"

import * as pt from "../model/point"
import * as a from "../model/angle"
import { Model, node } from "../model/model"
import { segment } from "../model/view"

export interface Turtle {
  position: pt.Point
  direction: a.Angle
  penDown: boolean
  model: Model
}

export function turtle(model: Model): Turtle {
  return {
    position: pt.origin,
    direction: a.degrees(0),
    penDown: true,
    model,
  }
}

export function forward(t: Turtle, dist: k.AnyNum) {
  const v = pt.scale(a.vec(t.direction), dist)
  const to = pt.add(t.position, v)
  const view = segment(node(t.model, t.position), node(t.model, to), t.penDown)
  t.model.views.push(view)
  t.position = to
}

export function left(t: Turtle, angle: a.Angle) {
  t.direction = a.sub(t.direction, angle)
}

export function right(t: Turtle, angle: a.Angle) {
  t.direction = a.add(t.direction, angle)
}
