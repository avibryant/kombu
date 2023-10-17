import { expect, test } from "vitest"

import { checkNotNull } from "./assert"
import * as k from "./api"
import * as g from "./grad"

import { wasmOptimizer } from "./wasmopt"

function optimize(
  loss: k.Num,
  init: Map<k.Param, number>,
  iterations: number,
  observations: Map<k.Param, number> = new Map(),
) {
  const optimizeImpl = wasmOptimizer(loss, g.gradient(loss), init)
  const params = optimizeImpl(iterations, observations)
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

test("free and fixed params", () => {
  const x = k.param("x")
  const y = k.observation("y")
  let loss = k.add(k.pow(x, 2), y)

  // Start close to the solution (1) and run for only a few iterations.
  const ev = optimize(loss, new Map([[x, 0.1]]), 100, new Map([[y, 1]]))
  expect(ev.evaluate(x)).toBeCloseTo(0, 2)

  expect(() => optimize(loss, new Map([[x, 0.1]]), 100)).toThrowError(
    /Missing observation 'y'/,
  )
})
