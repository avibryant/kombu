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

function basicOptimizer(
  loss: t.Num,
  gradient: Map<t.Param, t.Num>,
  init: Map<t.Param, number>,
) {
  return (iterations: number, observations: Map<t.Param, number>) => {
    const params = new Map([...init, ...observations])
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
    return new Map(params.entries())
  }
}

export function optimizer(loss: t.Num, init?: Map<t.Param, number>): Optimizer {
  const gradient = g.gradient(loss)

  // Ensure that we have an initial value for all free parameters.
  const freeParams = new Map(init)
  gradient.forEach((_, k) => {
    if (!freeParams.has(k)) freeParams.set(k, Math.random() * 10)
  })

  // The internal interface for optimizers is basically the same as the public
  // API, but implementations can assume that param values are fully specified.
  let optimizeImpl = (useWasm ? wasmOptimizer : basicOptimizer)(
    loss,
    gradient,
    freeParams,
  )

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

      const newParams = optimizeImpl(iterations, observations)
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
): e.Evaluator {
  return optimizer(loss, init).optimize(iterations, observations)
}
