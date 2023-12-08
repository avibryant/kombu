import { describe, expect, test } from "vitest"

import * as k from "./core/api"
import { lcg, standardNormalRandom } from "./core/random"
import { wasmOptimizer } from "./core/wasmopt"
import { Angle } from "./model/angle"
import { Model, emptyModel, someAngle, totalLoss } from "./model/model"
import { drawSierpinski, drawSquare } from "./turtle/draw"
import { Turtle, at, forward, right, turtle } from "./turtle/turtle"

function triangle(t: Turtle, side: k.AnyNum, a: Angle) {
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
}

function initParams(params: k.Param[]): Map<k.Param, number> {
  // Use the same seed (an arbitrary value) for each call, to ensure that
  // tests are deterministic and independent.
  const random = lcg(20231208)
  return new Map(params.map((p) => [p, standardNormalRandom(random)]))
}

function evaluateLoss(m: Model) {
  const loss = k.loss(totalLoss(m))
  const params = initParams(loss.freeParams)
  const jsEval = k.evaluator(params)
  const { evaluateLossForTesting } = wasmOptimizer(loss, params)
  return {
    jsResult: jsEval.evaluate(loss.value),
    wasmResult: evaluateLossForTesting(),
  }
}

describe("Wasm vs JS evaluation", () => {
  test("two triangles", () => {
    const m = emptyModel()
    const t = turtle(m)
    const start = t.position

    triangle(t, 100, someAngle(m, "a1"))
    at(t, start)
    triangle(t, 100, someAngle(m, "a2"))
    at(t, start)

    const { jsResult, wasmResult } = evaluateLoss(m)
    expect(wasmResult).toBe(jsResult)
  })

  test("squares", () => {
    const m = emptyModel()
    drawSquare(m)
    drawSquare(m)

    const { jsResult, wasmResult } = evaluateLoss(m)
    expect(wasmResult).toBeCloseTo(jsResult, 8)
  })

  test("sierpinski", () => {
    const m = emptyModel()
    drawSierpinski(m, 2)

    const { jsResult, wasmResult } = evaluateLoss(m)
    expect(wasmResult).toBeCloseTo(jsResult, 8)
  })
})
