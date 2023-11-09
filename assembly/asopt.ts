import { init, apply } from "./lbfgs"
import * as u from "./util"
import { double, uint } from "./types"

export function optimize(
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

    for (let i: uint = 0; i < numFreeParams; i++) {
      g[i] = u.evaluateGradient(i)
    }
    complete = apply(loss, g)

    // Copy params back out.
    for (let i: uint = 0; i < numFreeParams; i++) {
      u.setParam(i, x[i])
    }
  }
}
