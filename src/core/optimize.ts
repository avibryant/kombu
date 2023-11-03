import { assert } from "./assert"
import * as e from "./eval"
import * as g from "./grad"
import { collectParams } from "./params"
import * as t from "./types"
import { wasmOptimizer, OptimizeOptions } from "./wasmopt"

export type { OptimizeOptions, RMSPropOptions } from "./wasmopt"

export interface Loss {
  value: t.Num
  gradient: g.Gradient
  params: t.Param[]
}

export function loss(value: t.Num): Loss {
  const gradient = g.gradient(value)
  const params = collectParams(value)
  return {
    value, gradient, params
  }
}

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

export function optimizer(loss: Loss, init?: Map<t.Param, number>): Optimizer {
  // Ensure that we have an initial value for all free parameters.
  const freeParams = new Map(init)
  loss.params.forEach(p => {
    if (!p.fixed && !freeParams.has(p)) freeParams.set(p, standardNormalRandom())
  })

  // The internal optimizer inteface is similar to the public API, but we
  // assume that param values are fully specified.
  let optimizeImpl = wasmOptimizer(loss, freeParams)

  return {
    optimize(
      iterations: number,
      observations = new Map<t.Param, number>(),
      opts?: OptimizeOptions,
    ) {
      // Ensure that we have a value for all fixed parameters.
      loss.params
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
  loss: Loss,
  init: Map<t.Param, number>,
  iterations: number,
  observations?: Map<t.Param, number>,
  opts?: OptimizeOptions,
): e.Evaluator {
  return optimizer(loss, init).optimize(iterations, observations, opts)
}
