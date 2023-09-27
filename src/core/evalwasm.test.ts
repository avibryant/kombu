import { expect, test } from "vitest"

import * as k from "./api"

import { evaluator } from "./evalwasm"

test("constants", () => {
    const ev = evaluator(new Map())
    expect(ev(k.one)).toBe(1)
    expect(ev(k.zero)).toBe(0)
})

test("pow", () => {
    const ev = evaluator(new Map())
    expect(ev(k.pow(k.one, 2))).toBe(1)
})

test.only("param", () => {
    const x = k.param("x")
    const ev = evaluator(new Map([[x, 3]]))
    expect(ev(x)).toBe(3)
    expect(ev(k.add(x, 1))).toBe(4)
})
