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

test("params", () => {
    const x = k.param("x")
    const ev = evaluator(new Map([[x, 99]]))
    expect(ev(x)).toBe(99)
    expect(ev(k.add(x, 1))).toBe(100)

    const y = k.param("y")
    const ev2 = evaluator(
        new Map([
            [x, 100],
            [y, 200],
        ]),
    )
    expect(ev2(k.add(x, y))).toBe(300)
})


test("params", () => {
    const x = k.param("x")
    const ev = evaluator(new Map([[x, 99]]))
    expect(ev(x)).toBe(99)
    expect(ev(k.add(x, 1))).toBe(100)

    const y = k.param("y")
    const ev2 = evaluator(
        new Map([
            [x, 100],
            [y, 200],
        ]),
    )
    expect(ev2(k.add(x, y))).toBe(300)
})
