import { expect, test } from "vitest"

import * as k from "./api"

import { evaluator } from "./evalwasm"

test("constants", () => {
    const ev = evaluator(new Map())
    expect(ev(k.one)).toBe(1)
    expect(ev(k.zero)).toBe(0)
})
