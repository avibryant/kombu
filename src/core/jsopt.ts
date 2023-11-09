import { OptimizeOptions, defaultOptions } from "./wasmopt"
import * as t from "./types"
import { Loss } from "./loss"

import { optimize } from "../../build/asopt"
import { initEvaluatorState, getParamEntries } from "./asinterop"

export function jsOptimizer(loss: Loss, params: Map<t.Param, number>) {
  return (
    maxIterations: number,
    observations: Map<t.Param, number>,
    opts?: OptimizeOptions,
  ): Map<t.Param, number> => {
    initEvaluatorState(loss, params, observations)
    optimize(
      loss.freeParams.length,
      maxIterations,
      opts?.m ?? defaultOptions.m,
      opts?.epsilon ?? defaultOptions.epsilon,
    )
    return new Map(getParamEntries())
  }
}
