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

test.only("simple case with one param", () => {
  const x = k.param("x")
  const loss = k.pow(x, 2)

  // Start close to the solution (0) and run for only a few iterations.
  const ev = optimize(loss, new Map([[x, 0.1]]), 100)
  expect(ev.evaluate(x)).toBeCloseTo(0, 2)
})

test("free and fixed params", () => {
  const x = k.param("x")
  const h = k.observation("h")
  const y = k.observation("y")
  const loss = k.add(k.pow(k.sub(x, h), 2), y)

  const obs = new Map([
    [y, 10 ** 12],
    [h, 2500],
  ])

  // Start close to the solution and run for only a few iterations.
  let min = checkNotNull(obs.get(h))
  let ev = optimize(loss, new Map([[x, min + 0.1]]), 100, obs)
  expect(ev.evaluate(x)).toBeCloseTo(min, 2)

  obs.set(h, 5)
  min = 5
  ev = optimize(loss, new Map([[x, min + 0.1]]), 100, obs)
  expect(ev.evaluate(x)).toBeCloseTo(min, 2)

  expect(() => optimize(loss, new Map([[x, 0.1]]), 100)).toThrowError(
    /Missing observation 'h'/,
  )
})
