import * as k from "../core/api"

import { Distribution, logP } from "./distribution"

export interface Constraint {
  name: string
  dist: Distribution
  value: k.Num
  logP: k.Num
}

export function constraint(
  name: string,
  dist: Distribution,
  value: k.Num,
): Constraint {
  const lp = logP(dist, value)
  return { name, dist, value, logP: lp }
}
