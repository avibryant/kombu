import * as k from "../core/api"

import * as pt from "../model/point"
import * as a from "../model/angle"
import { Model, node, constrain, someAngle, someLength} from "../model/model"
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

export function forward(t: Turtle, length: k.AnyNum = someLength(t.model, 1000)): Side {
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


export function right(t: Turtle, angle: a.Angle = someAngle(t.model)): Turn {
  return turn(t, a.sub(a.degrees(0), angle))
}

export function left(t: Turtle, angle: a.Angle = someAngle(t.model)): Turn {
  return turn(t, angle)
}

export function hardRight(t: Turtle): Turn {
  return right(t, a.degrees(90))
}

export function hardLeft(t: Turtle): Turn {
  return left(t, a.degrees(90))
}

export function slightRight(t: Turtle): Turn {
  return right(t, someAngle(t.model, "slight"))
}

export function sharpRight(t: Turtle): Turn {
  return right(t, someAngle(t.model, "sharp"))
}

export function slightLeft(t: Turtle): Turn {
  return left(t, someAngle(t.model, "slight"))
}

export function sharpLeft(t: Turtle): Turn {
  return left(t, someAngle(t.model, "sharp"))
}

export function turn(t: Turtle, angle: a.Angle): Turn {
  const from = t.direction
  let to = a.add(from, angle)
  t.direction = to
  return {
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

export function parallel(t: Turtle, side: Side) {
  t.direction = side.direction
}

export function turnAround(t: Turtle) {
  left(t, a.degrees(180))
}

export function jump(t: Turtle, n: Node) {
  t.position = n
}