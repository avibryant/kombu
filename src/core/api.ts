export type { Evaluator } from "./eval"
export type { AnyNum } from "./num"
export type { Optimizer, OptimizeOptions } from "./optimize"
export type { Num, Param } from "./types"

export { param, observation, zero, one, nodeCount } from "./construct"
export { tex } from "./tex"
export { evaluator } from "./eval"
export { gradient } from "./grad"
export { optimize, optimizer } from "./optimize"
export {
  num,
  add,
  sub,
  mul,
  div,
  pow,
  sqrt,
  neg,
  abs,
  sign,
  cos,
  sin,
  atan,
  exp,
  log,
} from "./num"
export {
  logistic,
  softplus,
} from "./stats"
