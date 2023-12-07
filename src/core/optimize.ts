import { assert } from "./assert"
import { DEBUG_useDeterministicRNG } from "./debug"
import * as e from "./eval"
import { jsOptimizer } from "./jsopt"
import { Loss } from "./loss"
import * as t from "./types"
import { OptimizeOptions, wasmOptimizer } from "./wasmopt"

export type { OptimizeOptions } from "./wasmopt"

export interface Optimizer {
  optimize(
    iterations: number,
    observations?: Map<t.Param, number>,
    opts?: OptimizeOptions,
  ): e.Evaluator
}

// https://en.wikipedia.org/wiki/Linear_congruential_generator
function lcg(x0: number) {
  // Use same params as ANSI C.
  const m = 2 ** 32
  const a = 1103515245
  const c = 12345
  let x = x0
  return () => {
    x = (a * x + c) % m
    return x / m
  }
}

// Use our own random number generation, since Math.random() can't be seeded.
const random = lcg(DEBUG_useDeterministicRNG() ? 853570741 : Date.now() % 1e9)

function standardNormalRandom() {
  return (
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  )
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
