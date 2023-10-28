import * as k from "../core/api"

import { Distribution, logP } from "./distribution"

export interface Constraint {
  dist: Distribution
  value: k.Num
  logP: k.Num
}

export function constraint(
  dist: Distribution, 
  value: k.Num
): Constraint {
  const lp = logP(dist, value)
  return {dist, value, logP: lp}
}
