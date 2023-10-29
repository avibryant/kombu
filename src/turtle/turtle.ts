import * as k from "../core/api"

import * as pt from "../model/point"
import * as a from "../model/angle"
import { Model, node, constrain} from "../model/model"
import { segment } from "../model/view"
import { Node } from "../model/node"
import {normal} from "../model/distribution"
import {distance} from "../model/point"

export interface Turtle {
  position: Node
  direction: a.Angle
  penDown: boolean
  model: Model
}

export interface Side {
  from: Node
  to: Node
  direction: a.Angle
  length: k.Num
  model: Model
}

export interface Turn {
  direction: "left" | "right"
  from: a.Angle
  to: a.Angle
  by: a.Angle
  position: Node
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

export function forward(t: Turtle, length: k.AnyNum): Side {
  const v = pt.scale(a.vec(t.direction), length)
  const from = t.position
  const to = node(t.model, pt.add(t.position.point, v))
  const view = segment(from, to, t.penDown)
  t.model.views.push(view)
  t.position = to
  return {
    from,
    to,
    direction: t.direction,
    length: k.num(length),
    model: t.model
  }
}


export function left(t: Turtle, angle: a.Angle): Turn {
  return turn(t, angle, "left")
}

export function right(t: Turtle, angle: a.Angle): Turn {
  return turn(t, angle, "right")
}

function turn(t: Turtle, angle: a.Angle, direction: "left" | "right"): Turn {
  const from = t.direction
  let to = a.sub(from, angle)
  if(direction == "right")
    to = a.add(from, angle)

  t.direction = to
  return {
    direction,
    from,
    to,
    by: angle,
    position: t.position,
    model: t.model
  }
}

export function at(t: Turtle, node: Node) {
  const d = distance(t.position.point, node.point)
  constrain(t.model, normal(0, 1), d)
}

export function midpoint(side: Side): Node {
  const v = pt.scale(a.vec(side.direction), k.div(side.length, 2))
  return node(side.model, pt.add(side.from.point, v))
}