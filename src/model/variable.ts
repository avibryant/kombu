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

export function lengthVariable(name: string): LengthVariable {
  const param = k.param(name)
  const value = k.exp(param)
  return {
    type: "length",
    param,
    value,
    logJ: param
  }
}

export function angleVariable(name: string): AngleVariable {
  const param = k.param(name)
  //range: (-1,1)

  const logisticParam = k.logistic(param)
  const value = k.sub(k.mul(2, logisticParam), 1)

  return {
    type: "angle",
    param,
    value,
    logJ: k.mul(k.add(
      k.log(2),
      k.add(
        k.log(logisticParam), 
        k.log(k.sub(1, logisticParam)))), -1)
  }
}
