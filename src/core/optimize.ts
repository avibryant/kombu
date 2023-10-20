import { assert } from "./assert"
import * as e from "./eval"
import * as g from "./grad"
import { collectParams } from "./params"
import * as t from "./types"
import { wasmOptimizer, OptimizeOptions } from "./wasmopt"

export type { OptimizeOptions, RMSPropOptions } from "./wasmopt"

export interface Optimizer {
  optimize(
    iterations: number,
    observations?: Map<t.Param, number>,
    opts?: OptimizeOptions,
  ): e.Evaluator
}

function standardNormalRandom() {
  return (
    Math.sqrt(-2 * Math.log(1 - Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  )
}

export function optimizer(loss: t.Num, init?: Map<t.Param, number>): Optimizer {
  const gradient = g.gradient(loss)

  // Ensure that we have an initial value for all free parameters.
  const freeParams = new Map(init)
  gradient.forEach((_, k) => {
    if (!freeParams.has(k)) freeParams.set(k, standardNormalRandom())
  })

  // The internal optimizer inteface is similar to the public API, but we
  // assume that param values are fully specified.
  let optimizeImpl = wasmOptimizer(loss, gradient, freeParams)

  return {
    optimize(
      iterations: number,
      observations = new Map<t.Param, number>(),
      opts?: OptimizeOptions,
    ) {
      // Ensure that we have a value for all fixed parameters.
      collectParams(loss)
        .filter((p) => p.fixed)
        .forEach((p) => {
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
  loss: t.Num,
  init: Map<t.Param, number>,
  iterations: number,
  observations?: Map<t.Param, number>,
  opts?: OptimizeOptions,
): e.Evaluator {
  return optimizer(loss, init).optimize(iterations, observations, opts)
}
