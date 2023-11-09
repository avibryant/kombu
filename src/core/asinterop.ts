import { assert, checkNotNull } from "./assert"
import { evaluator, Evaluator } from "./eval"
import { Loss } from "./loss"
import { Param } from "./types"

let loss: Loss
let ev: Evaluator
let paramEntries: [Param, number][]

export function initEvaluatorState(
  l: Loss,
  params: Map<Param, number>,
  obs: Map<Param, number>,
) {
  loss = l
  paramEntries = [...params.entries(), ...obs.entries()]
}

export function getParamEntries(): [Param, number][] {
  return paramEntries
}

// TypeScript impl of the API defined by assembly/types.ts

export type double = number
export type int = number
export type uint = number
export type ArrayOfDouble = number[]

// TypeScript impl of the API defined by assembly/util.ts

export function newArrayOfDouble(len: number) {
  return new Array(len).fill(0)
}

export function getParam(i: number): number {
  assert(i < loss.freeParams.length, `invalid free param index: ${i}`)
  return paramEntries[i][1]
}

export function setParam(i: number, val: number): void {
  assert(i < loss.freeParams.length, `invalid free param index: ${i}`)
  paramEntries[i][1] = val
}

export function evaluateLoss(): number {
  ev = evaluator(new Map(paramEntries))
  return ev.evaluate(loss.value)
}

export function evaluateGradient(i: number): number {
  assert(i < loss.freeParams.length, `invalid index in gradient: ${i}`)
  const param = paramEntries[i][0]
  return ev.evaluate(checkNotNull(loss.gradient.elements.get(param)))
}
