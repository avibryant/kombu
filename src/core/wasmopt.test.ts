import { expect, test } from "vitest"

import { checkNotNull } from "./assert"
import * as k from "./api"
import { loss } from "./loss"

import { wasmOptimizer } from "./wasmopt"

function optimize(
  lossNum: k.Num,
  init: Map<k.Param, number>,
  iterations: number,
  observations: Map<k.Param, number> = new Map(),
) {
  const l = loss(lossNum)
  const optimizeImpl = wasmOptimizer(l, init)
  const params = optimizeImpl(iterations, observations)
  return {
    evaluate(p: k.Param) {
      return checkNotNull(params.get(p))
    },
  }
}

test("simple case with one param", () => {
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

test(">16 cache entries", () => {
  const x = k.param("x")
  const h = k.observation("h")
  const ys: k.Param[] = []

  for (let i = 0; i < 16; i++) {
    ys[i] = k.observation(`y${i}`)
  }
  const y = ys.reduce((acc: k.Num, p) => k.add(acc, p), k.zero)
  const loss = k.add(k.pow(k.sub(x, h), 2), y)

  const obs: Map<k.Param, number> = new Map([
    [h, 2500],
    ...ys.map((p, i): [k.Param, number] => [p, i % 2 === 0 ? 1 : -1]),
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

test.skip("NaN when evaluating sqrt", () => {
  const a = k.param("a")
  const ev1 = k.evaluator(new Map([[a, -1]]))
  console.log(ev1.evaluate(k.sqrt(k.mul(a, k.add(a, 1e-3)))))
})

test.skip("LBFGS not terminating", () => {
  const hint = 20
  const a = k.param("a")
  const value = k.mul(hint, k.abs(a))

  let ev = optimize(value, new Map([[a, 8]]), 100)
  expect(ev.evaluate(a)).toBeCloseTo(8, 2)
})
