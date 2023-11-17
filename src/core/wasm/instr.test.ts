import * as w from "@wasmgroundup/emit"
import { dedent } from "ts-dedent"
import { expect, test } from "vitest"

import * as prebuilt from "../../../build/release.wasm_sections"
import { builtins } from "./builtins"
import * as i from "./instr"

const powIdx =
  builtins.findIndex((fn) => fn.name === "pow") + prebuilt.importsec.entryCount

test("prettyPrint: const", () => {
  expect(i.prettyPrint(i.f64_const("x", 99))).toEqual("f64.const 99")
  expect(i.prettyPrint(i.f64_const("x", 12345.678))).toEqual(
    "f64.const 12345.678",
  )
})

test("binary", () => {
  const l = i.f64_const("x", 123.456)
  const r = i.f64_const("x", 99)
  expect(i.prettyPrint(i.f64_binOp("x", "add", l, r))).toEqual(dedent`
    f64.const 123.456
    f64.const 99
    f64.add
  `)

  expect(i.toBytes(i.f64_binOp("x", "add", l, r))).toEqual(
    [
      [w.instr.f64.const, w.f64(123.456)],
      [w.instr.f64.const, w.f64(99)],
      w.instr.f64.add,
    ].flat(2),
  )
})

test("prettyPrint: load", () => {
  expect(i.prettyPrint(i.f64_load("x", 99))).toEqual(dedent`
    i32.const 99
    f64.load {3,0}
  `)
})

test("prettyPrint: store", () => {
  const store = i.f64_store("x", 99, i.f64_const("y", 123.456))
  expect(i.prettyPrint(store)).toEqual(dedent`
    i32.const 99
    f64.const 123.456
    f64.store {3,0}
  `)
})

test("prettyPrint: call", () => {
  expect(i.prettyPrint(i.callBuiltin("x", "pow"))).toEqual(dedent`
    call $${powIdx} (pow)
  `)
})

test("toBytes: const", () => {
  expect(i.toBytes(i.f64_const("x", 99))).toEqual([
    0x44, 0, 0, 0, 0, 0, 192, 88, 64,
  ])
  //    expect(i.toBytes(i.f64_const("x", 12345.678))).toEqual("f64.const 12345.678")
})
test("toBytes: load", () => {
  expect(i.toBytes(i.f64_load("x", 99))).toEqual(
    [
      [w.instr.i32.const, w.i32(99)],
      [w.instr.f64.load, [3, 0]],
    ].flat(2),
  )
})
test("toBytes: store", () => {
  const store = i.f64_store("x", 99, i.f64_const("y", 123.456))
  expect(i.toBytes(store)).toEqual(
    [
      [w.instr.i32.const, w.i32(99)],
      [w.instr.f64.const, w.f64(123.456)],
      [w.instr.f64.store, [3, 0]],
    ].flat(2),
  )
})
test("toBytes: call", () => {
  expect(i.toBytes(i.callBuiltin("x", "pow"))).toEqual([
    w.instr.call,
    ...w.funcidx(powIdx),
  ])
})
