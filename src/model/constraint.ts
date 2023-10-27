import * as k from "../core/api"

import { distance } from "./point"
import { Node } from "./node"

export interface Constraint {
  a: Node
  b: Node
  distance: number
  sd: number
  loss: k.Num
  keys?: {up: string, down: string}
}

export function constraint(
  a: Node,
  b: Node,
  dist: number,
  sd: number,
  keys?: {up: string, down: string}
): Constraint {
  const loss = computeLoss(a, b, dist, sd)
  return { a, b, distance: dist, sd, loss, keys }
}

function computeLoss(a: Node, b: Node, dist: number, sd: number) {
  const d = distance(a.point, b.point)
  const dd = k.sub(dist, d)
  return k.div(k.mul(dd, dd), k.mul(2, k.mul(sd, sd)))
}

export function increase(c: Constraint) {
  c.distance *= 1.05
  c.loss = computeLoss(c.a, c.b, c.distance, c.sd)
}

export function decrease(c: Constraint) {
  c.distance /= 1.05
  c.loss = computeLoss(c.a, c.b, c.distance, c.sd)
}
