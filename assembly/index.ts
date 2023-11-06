import {
  evaluateLoss,
  evaluateGradient,
  getParam,
  newStaticArray,
  setParam,
} from "./util"

import { init, apply } from "./lbfgs"

export function optimize(numFreeParams: u32): void {
  const x = newStaticArray<f64>(numFreeParams)
  const g = newStaticArray<f64>(numFreeParams)

  let complete = false
  const m = 5
  const eps = 0.1

  init(x, m, eps)

  // Copy params in.
  for (let i: u32 = 0; i < numFreeParams; i++) {
    x[i] = getParam(i)
  }

  // We need to evaluate the loss before any gradients.
  evaluateLoss()

  while (!complete) {
    for (let i: u32 = 0; i < numFreeParams; i++) {
      g[i] = evaluateGradient(i)
    }
    complete = apply(evaluateLoss(), g)

    // Copy params back out.
    for (let i: u32 = 0; i < numFreeParams; i++) {
      setParam(i, x[i])
    }
  }
}
