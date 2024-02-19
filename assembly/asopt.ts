import { init, apply } from "./lbfgs"
import * as u from "./util"
import { double, uint } from "./types"

export function optimizeLBFGS(
  numFreeParams: uint,
  maxIterations: uint,
  m: uint,
  eps: double,
): void {
  const x = u.newArrayOfDouble(numFreeParams)
  const g = u.newArrayOfDouble(numFreeParams)

  let complete = false

  init(x, m, eps)

  // Copy params in.
  for (let i: uint = 0; i < numFreeParams; i++) {
    x[i] = u.getParam(i)
  }

  for (let i: uint = 0; i < maxIterations && !complete; i++) {
    const loss = u.evaluateLoss()

    let nonZero = false
    for (let i: uint = 0; i < numFreeParams; i++) {
      g[i] = u.evaluateGradient(i)
      if (g[i] !== 0) nonZero = true
    }
    if (nonZero) complete = apply(loss, g)

    // Copy params back out.
    for (let i: uint = 0; i < numFreeParams; i++) {
      u.setParam(i, x[i])
    }
  }
}

export function optimizeGradientDescent(
  numFreeParams: uint,
  maxIterations: uint,
  learningRate: double,
): void {
  for (let i: uint = 0; i < maxIterations; i++) {
    u.evaluateLoss()

    for (let j: uint = 0; j < numFreeParams; j++) {
      const g = u.evaluateGradient(j)
      u.setParam(j, u.getParam(j) - learningRate * g)
    }
  }
}

export function evaluateLossForTesting(): double {
  return u.evaluateLoss()
}
