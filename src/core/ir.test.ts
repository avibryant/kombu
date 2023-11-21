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
    expect(ir.pseudocode(mod.loss)).toBe("x ** 2")
  })

  test("mixture of binary expressions", () => {
    const lossValue = k.add(k.pow(k.param("x"), 2), k.mul(2, k.param("y")))
    const mod = ir.module(loss(lossValue))
    expect(ir.pseudocode(mod.loss)).toBe("2 * y + x ** 2")
  })

  test("reused expressions", () => {
    const x = k.param("x")
    const lossValue = k.add(k.pow(k.abs(x), 2), k.mul(3, k.log(k.abs(x))))
    const mod = ir.module(loss(lossValue))
    expect(ir.pseudocode(mod.loss)).toBe(
      "temp0 = abs(x)\n3 * log(temp0) + temp0 ** 2",
    )
  })
})

function checkBinary(exp: ir.Expr): ir.BinaryExpr {
  if (exp.type !== ir.ExprType.Binary) throw new Error("not a Binary")
  return exp as ir.BinaryExpr
}

const toIR = (num: k.Num) => ir.module(loss(num)).loss

test("simplification - plus", () => {
  const x = k.param("x")
  const y = k.param("y")

  // x - 3
  let exp = toIR(k.sub(x, 3))
  expect(exp.type).toBe(ir.ExprType.Binary)
  expect(checkBinary(exp).op).toBe("-")

  // 3 - x
  exp = toIR(k.sub(3, k.param("x")))
  expect(exp.type).toBe(ir.ExprType.Binary)
  expect(checkBinary(exp).op).toBe("-")

  // -1x + y => y - x
  exp = toIR(k.add(k.mul(-1, x), y))
  expect(exp).toEqual(ir.binary("-", ir.param(y), ir.param(x)))

  // x + (-1y + 3) => (x - y) + 3
  exp = toIR(k.add(x, k.add(k.mul(-1, y), 3)))
  expect(exp).toEqual(
    ir.binary("+", ir.binary("-", ir.param(x), ir.param(y)), ir.constant(3)),
  )
})

test("simplification - neg exponents", () => {
  const x = k.param("x")
  const y = k.param("y")

  // 2 * y^-1 + x = 2/y + x
  let exp = toIR(k.add(k.mul(2, k.pow(y, -1)), x))
  expect(exp).toEqual(
    ir.binary("+", ir.binary("/", ir.constant(2), ir.param(y)), ir.param(x)),
  )

  // 3 * x^-1 = 3/x
  exp = toIR(k.mul(3, k.pow(x, -1)))
  expect(exp).toEqual(ir.binary("/", ir.constant(3), ir.param(x)))
})
