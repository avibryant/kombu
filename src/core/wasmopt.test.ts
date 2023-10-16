import { expect, test } from "vitest"

import { checkNotNull } from "./assert"
import * as k from "./api"
import * as g from "./grad"

import { wasmOptimizer } from "./wasmopt"

function optimize(loss: k.Num, init: Map<k.Param, number>, iterations: number) {
  const optimizeImpl = wasmOptimizer(loss, g.gradient(loss))
  const params = optimizeImpl(init, new Map(), iterations)
  return {
    evaluate(p: k.Param) {
      return checkNotNull(params.get(p))
    },
  }
}

test("simple case with one param", () => {
  const x = k.param("x")
  let loss = k.pow(x, 2)

  // Start close to the solution (0) and run for only a few iterations.
  const ev = optimize(loss, new Map([[x, 0.1]]), 100)
  expect(ev.evaluate(x)).toBeCloseTo(0, 2)
})
