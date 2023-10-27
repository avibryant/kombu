import * as k from "../core/api"

export type Distribution = Normal
export interface Normal {
  type: "normal"
  mean: number
  sd: number
}

export function normal(mean: number, sd: number): Distribution {
  return {
    type: "normal",
    mean,
    sd,
  }
}

export function logP(dist: Distribution, value: k.Num): k.Num {
  switch (dist.type) {
    case "normal":
      return normalLogP(dist, value)
      break
  }
}

function normalLogP(dist: Normal, value: k.Num): k.Num {
  const diff = k.sub(value, dist.mean)
  return k.div(k.mul(diff, diff), k.mul(2, k.mul(dist.sd, dist.sd)))
}
