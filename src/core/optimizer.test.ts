import { expect, test } from "vitest"

import * as k from "./api"

import { optimizer } from "./optimizer"

test("constants", () => {
  const roots = [k.one, k.zero]
  const ev = optimizer(roots, new Map()).evaluate
  expect(ev(k.one)).toBe(1)
  expect(ev(k.zero)).toBe(0)
})

test("pow", () => {
  const num1 = k.pow(k.one, 2)
  const ev = optimizer([num1], new Map()).evaluate
  expect(ev(num1)).toBe(1)
})

test("solitary params", () => {
  const x = k.param("x")
  let add = k.add(x, 1)
  const ev = optimizer([x, add], new Map([[x, 99]])).evaluate
  expect(ev(x)).toBe(99)
  expect(ev(add)).toBe(100)

  const y = k.param("y")
  add = k.add(x, y)
  const ev2 = optimizer(
    [x, y, add],
    new Map([
      [x, 100],
      [y, 200],
    ]),
  ).evaluate
  expect(ev2(add)).toBe(300)
})
