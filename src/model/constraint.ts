import * as k from "../core/api"

import { Distribution, logP, normal } from "./distribution"
import { distance } from "./point"
import { Node } from "./node"

export interface Constraint {
  dist: Distribution
  value: k.Num
  loss: k.Num
}

export function constraint(
  a: Node,
  b: Node,
  d: number,
  sd: number,
): Constraint {
  const value = distance(a.point, b.point)
  const norm = normal(d, sd)
  const loss = logP(norm, value)
  return { dist: norm, value, loss }
}
