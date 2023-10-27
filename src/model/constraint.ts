import * as k from "../core/api"

import { distance } from "./point"
import { Node } from "./node"

export interface Constraint {
  a: Node
  b: Node
  distance: number
  sd: number
  loss: k.Num
}

export function constraint(
  a: Node,
  b: Node,
  dist: number,
  sd: number,
): Constraint {
  const d = distance(a.point, b.point)
  const dd = k.sub(dist, d)
  const loss = k.div(k.mul(dd, dd), k.mul(2, k.mul(sd, sd)))
  return { a, b, distance: dist, sd, loss }
}
