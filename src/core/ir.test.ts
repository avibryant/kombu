import { describe, expect, test } from "vitest"

import * as k from "./api"
import * as ir from "./ir"
import { loss } from "./loss"

describe("lisp", () => {
  test("simple case with one param", () => {
    const lossValue = k.pow(k.param("x"), 2)
    const mod = ir.module(loss(lossValue))
    expect(ir.lisp(mod.loss)).toBe("(pow x 2)")
  })

  test("reused expressions", () => {
    const x = k.param("x")
    const lossValue = k.add(k.pow(k.abs(x), 2), k.mul(3, k.log(k.abs(x))))
    const mod = ir.module(loss(lossValue))
    expect(ir.lisp(mod.loss)).toBe(
      "(let* ([temp0 (abs x)]) (+ (* 3 (log temp0)) (pow temp0 2)))",
    )
  })
})

describe("pseudocode", () => {
  test("simple case with one param", () => {
    const lossValue = k.pow(k.param("x"), 2)
    const mod = ir.module(loss(lossValue))
    expect(ir.pseudocode(mod.loss)).toBe("pow(x, 2)")
  })

  test("mixture of binary expressions", () => {
    const lossValue = k.add(k.pow(k.param("x"), 2), k.mul(2, k.param("y")))
    const mod = ir.module(loss(lossValue))
    expect(ir.pseudocode(mod.loss)).toBe("2 * y + pow(x, 2)")
  })

  test("reused expressions", () => {
    const x = k.param("x")
    const lossValue = k.add(k.pow(k.abs(x), 2), k.mul(3, k.log(k.abs(x))))
    const mod = ir.module(loss(lossValue))
    expect(ir.pseudocode(mod.loss)).toBe(
      "temp0 = abs(x)\n3 * log(temp0) + pow(temp0, 2)",
    )
  })
})
