import { checkNotNull } from "./assert"
import { evaluator } from "./eval"
import * as lbfgs from "./lbfgs"
import { Loss } from "./loss"
import * as t from "./types"
import { OptimizeOptions, defaultOptions } from "./wasmopt"

import { optimizeGradientDescent, optimizeLBFGS } from "../../build/asopt"
import { getParamEntries, initEvaluatorState } from "./asinterop"

const usePenroseLBFGS = true

export function jsOptimizer(loss: Loss, params: Map<t.Param, number>) {
  function optimize(
    maxIterations: number,
    observations: Map<t.Param, number>,
    opts?: OptimizeOptions,
  ): Map<t.Param, number> {
    const options = {
      ...defaultOptions,
      ...(opts ?? {}),
    }

    if (options.method === "LBFGS" && usePenroseLBFGS) {
      return new Map(optimizeLBFGS2(loss, params, observations, maxIterations))
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
  return { optimize }
}

export function optimizeLBFGS2(
  loss: Loss,
  freeParams: Map<t.Param, number>,
  observations: Map<t.Param, number>,
  maxIterations: number,
  // m: number,
  // eps: number,
): [t.Param, number][] {
  const paramEntries = Array.from(freeParams.entries())
  const grad = paramEntries.map(([p]) =>
    checkNotNull(loss.gradient.elements.get(p)),
  )

  const xs = new Float64Array(paramEntries.map(([_, val]) => val))
  const gradfxs = new Float64Array(freeParams.size)
  const gradientPreconditioned = new Float64Array(gradfxs)
  let normGradfxs = 0
  const cfg: lbfgs.Config = {
    m: 17,
    armijo: 0.001,
    wolfe: 0.9,
    minInterval: 1e-9,
    maxSteps: 10,
    epsd: 1e-11,
  }
  const evalLossAndGrad = (x: Float64Array, gradout: Float64Array) => {
    const ev = evaluator(
      new Map([
        ...paramEntries.map(([p, _], i): [t.Param, number] => [p, x[i]]),
        ...observations.entries(),
      ]),
    )
    const ret = ev.evaluate(loss.value)
    grad.forEach((num, i) => {
      gradout[i] = ev.evaluate(num)
    })
    return ret
  }
  const state = lbfgs.firstStep(cfg, evalLossAndGrad, xs)

  let stepCount = 0
  lbfgs.stepUntil(cfg, evalLossAndGrad, xs, state, (info) => {
    if (stepCount++ > maxIterations) return false

    if (containsNaN(info.state.x)) {
      console.log("xs", xs)
      throw Error("NaN in xs")
    }
    gradfxs.set(info.state.grad)
    if (containsNaN(gradfxs)) {
      console.log("gradfxs", gradfxs)
      throw Error("NaN in gradfxs")
    }
    gradientPreconditioned.set(info.r)

    // Don't take the Euclidean norm. According to Boyd (485), we should use the Newton descent check, with the norm of the gradient pulled back to the nicer space.
    normGradfxs = dot(gradfxs, gradientPreconditioned)
    if (normGradfxs < uoStop) {
      return false
    }
    return undefined
  })
  return paramEntries.map(([p, _], i) => [p, xs[i]])
}

const uoStop = 1e-2

function dot(xs: Float64Array, ys: Float64Array) {
  let z = 0
  for (let i = 0; i < xs.length; i++) z += xs[i] * ys[i]
  return z
}

const containsNaN = (arr: Float64Array) => arr.some((n) => Number.isNaN(n))
