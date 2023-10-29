import * as k from "../core/api"

export interface Variable {
  type: "length" | "angle"
  param: k.Param
  value: k.Num,
  logJ: k.Num
}

interface AngleVariable extends Variable {
  type: "angle"
}

interface LengthVariable extends Variable {
  type: "length"
}

export function lengthVariable(): LengthVariable {
  const param = k.param("p")
  const value = k.exp(param)
  return {
    type: "length",
    param,
    value,
    logJ: param
  }
}

export function angleVariable(min: number = -1, max: number = 1): AngleVariable {
  const param = k.param("p")
  const logisticParam = k.logistic(param)
  const value = k.add(k.mul(max - min, logisticParam), min)

  return {
    type: "angle",
    param,
    value,
    logJ: k.mul(k.add(
      k.log(max - min),
      k.add(
        k.log(logisticParam), 
        k.log(k.sub(1, logisticParam)))), -1)
  }
}
