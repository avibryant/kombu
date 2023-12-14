import { assert } from "./assert"
import * as e from "./eval"
import { jsOptimizer } from "./jsopt"
import { Loss } from "./loss"
import { OptimizeOptions } from "./options"
import { standardNormalRandom } from "./random"
import * as t from "./types"
import { wasmOptimizer } from "./wasmopt"

export interface Optimizer {
  optimize(
    iterations: number,
    observations?: Map<t.Param, number>,
    opts?: OptimizeOptions,
  ): e.Evaluator
}

export function optimizer(
  loss: Loss,
  init?: Map<t.Param, number>,
  useWasm = true,
): Optimizer {
  // Ensure that we have an initial value for all free parameters.
  const freeParams = new Map(init)
  loss.freeParams.forEach((p) => {
    if (!freeParams.has(p)) freeParams.set(p, standardNormalRandom())
  })

  // The internal optimizer interface is similar to the public API, but we
  // assume that param values are fully specified.
  let optimizeImpl = (useWasm ? wasmOptimizer : jsOptimizer)(
    loss,
    freeParams,
  ).optimize

  return {
    optimize(
      iterations: number,
      observations = new Map<t.Param, number>(),
      opts?: OptimizeOptions,
    ) {
      // Ensure that we have a value for all fixed parameters.
      loss.fixedParams.forEach((p) => {
        assert(
          !!observations.get(p),
          `missing value for observation '${p.name}'`,
        )
      })

      const newParams = optimizeImpl(iterations, observations, opts)
      newParams.forEach((v, p) => {
        freeParams.set(p, v)
      })
      return e.evaluator(new Map(newParams))
    },
  }
}

export function optimize(
  loss: Loss,
  init: Map<t.Param, number>,
  iterations: number,
  observations?: Map<t.Param, number>,
  opts?: OptimizeOptions,
): e.Evaluator {
  return optimizer(loss, init).optimize(iterations, observations, opts)
}
