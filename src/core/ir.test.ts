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
  if (exp.type !== ir.ExprType.Binary) throw new Error()
  return exp as ir.BinaryExpr
}

test("simplification - plus", () => {
  // x - 3
  let mod = ir.module(loss(k.sub(k.param("x"), 3)))
  expect(mod.loss.type).toBe(ir.ExprType.Binary)
  expect(checkBinary(mod.loss).op).toBe("-")

  // -1x + y => y - x
  mod = ir.module(loss(k.add(k.mul(-1, k.param("x")), k.param("y"))))
  expect(mod.loss.type).toBe(ir.ExprType.Binary)
  expect(checkBinary(mod.loss).op).toBe("-")

  // 3 - x
  mod = ir.module(loss(k.sub(3, k.param("x"))))
  expect(mod.loss.type).toBe(ir.ExprType.Binary)
  expect(checkBinary(mod.loss).op).toBe("-")

  // x + (-1y + 3) => (x - y) + 3
  mod = ir.module(loss(k.add(k.param("x"), k.add(k.mul(-1, k.param("y")), 3))))

  expect(mod.loss.type).toBe(ir.ExprType.Binary)
  expect(checkBinary(mod.loss).op).toBe("+")
  const lhs = checkBinary(mod.loss).l
  expect(lhs.type).toBe(ir.ExprType.Binary)
  expect(checkBinary(lhs).op).toBe("-")
})
