import { OptimizeOptions, defaultOptions } from "./wasmopt"
import * as t from "./types"
import { Loss } from "./loss"

import { optimizeLBFGS, optimizeGradientDescent } from "../../build/asopt"
import { initEvaluatorState, getParamEntries } from "./asinterop"

export function jsOptimizer(loss: Loss, params: Map<t.Param, number>) {
  return (
    maxIterations: number,
    observations: Map<t.Param, number>,
    opts?: OptimizeOptions,
  ): Map<t.Param, number> => {
    const options = {
      ...defaultOptions,
      ...(opts ?? {}),
    }

    initEvaluatorState(loss, params, observations)
    switch (options.method) {
      case "LBFGS":
        optimizeLBFGS(
          loss.freeParams.length,
          maxIterations,
          options.m,
          options.epsilon,
        )
        break
      case "GradientDescent":
        optimizeGradientDescent(
          loss.freeParams.length,
          maxIterations,
          options.learningRate,
        )
        break
    }
    return new Map(getParamEntries())
  }
}
