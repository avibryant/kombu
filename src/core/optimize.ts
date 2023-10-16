import { assert, checkNotNull } from "./assert"
import * as e from "./eval"
import * as g from "./grad"
import { collectParams } from "./params"
import * as t from "./types"
import { wasmOptimizer } from "./wasmopt"

const useWasm = true

export interface Optimizer {
  optimize(iterations: number, observations?: Map<t.Param, number>): e.Evaluator
}

function basicOptimizer(loss: t.Num, gradient: Map<t.Param, t.Num>) {
  return (
    freeParams: Map<t.Param, number>,
    observations: Map<t.Param, number>,
    iterations: number,
  ) => {
    const params = new Map([...freeParams, ...observations])
    const epsilon = 0.0001
    let i = iterations
    while (i > 0) {
      const ev = e.evaluator(params)
      const l = ev.evaluate(loss)
      if (i % 1000 == 0) {
        console.log(l)
      }
      gradient.forEach((v, k) => {
        const diff = ev.evaluate(v)
        const old = params.get(k) || 0
        const update = old - diff * epsilon
        params.set(k, update)
      })
      i = i - 1
    }
    return params.entries()
  }
}

export function optimizer(loss: t.Num, init?: Map<t.Param, number>): Optimizer {
  const gradient = g.gradient(loss)

  let optimizeImpl = (useWasm ? wasmOptimizer : basicOptimizer)(loss, gradient)

  // Ensure that we have an initial value for all free parameters.
  const freeParams = new Map(init)
  gradient.forEach((_, k) => {
    if (!freeParams.has(k)) freeParams.set(k, Math.random() * 10)
  })

  return {
    optimize(iterations: number, observations = new Map<t.Param, number>()) {
      // Ensure that we have a value for all fixed parameters.
      collectParams(loss)
        .filter((p) => p.fixed)
        .forEach((p) => {
          assert(
            !!checkNotNull(observations.get(p)),
            `missing value for observation '${p.name}'`,
          )
        })

      const newParams = optimizeImpl(freeParams, observations, iterations)
      return e.evaluator(new Map(newParams))
    },
  }
}

export function optimize(
  loss: t.Num,
  init: Map<t.Param, number>,
  iterations: number,
): e.Evaluator {
  return optimizer(loss, init).optimize(iterations)
}
