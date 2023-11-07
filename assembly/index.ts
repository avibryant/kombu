import {
  evaluateLoss,
  evaluateGradient,
  getParam,
  newStaticArray,
  setParam,
} from "./util"

import { init, apply } from "./lbfgs"

export function optimize(
  numFreeParams: u32,
  maxIterations: u32,
  m: u32,
  eps: f64,
): void {
  const x = newStaticArray<f64>(numFreeParams)
  const g = newStaticArray<f64>(numFreeParams)

  let complete = false

  init(x, m, eps)

  // Copy params in.
  for (let i: u32 = 0; i < numFreeParams; i++) {
    x[i] = getParam(i)
  }

  for (let i: u32 = 0; i < maxIterations && !complete; i++) {
    const loss = evaluateLoss()

    for (let i: u32 = 0; i < numFreeParams; i++) {
      g[i] = evaluateGradient(i)
    }
    complete = apply(loss, g)

    // Copy params back out.
    for (let i: u32 = 0; i < numFreeParams; i++) {
      setParam(i, x[i])
    }
  }
}
