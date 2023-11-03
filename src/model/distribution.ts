import * as k from "../core/api"

export type Distribution = MeanSD
export interface MeanSD {
  type: "normal" | "lognormal"
  mean: k.Num
  sd: k.Num
}

export function normal(mean: k.AnyNum, sd: k.AnyNum): Distribution {
  return {
    type: "normal",
    mean: k.num(mean),
    sd: k.num(sd),
  }
}

export function logNormal(mean: k.AnyNum, sd: k.AnyNum): Distribution {
  return {
    type: "lognormal",
    mean: k.num(mean),
    sd: k.num(sd),
  }
}

export function logP(dist: Distribution, value: k.Num): k.Num {
  switch (dist.type) {
    case "normal":
      return normalLogP(dist, value)
    case "lognormal":
      return logNormalLogP(dist, value)
  }
}

function normalLogP(dist: MeanSD, value: k.Num): k.Num {
  const diff = k.sub(value, dist.mean)
  return k.div(k.mul(diff, diff), k.mul(2, k.mul(dist.sd, dist.sd)))
}

function logNormalLogP(dist: MeanSD, value: k.Num): k.Num {
  return k.sub(normalLogP(dist, k.log(value)), k.log(value))
}
