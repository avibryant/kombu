import * as w from "@wasmgroundup/emit"

import * as prebuilt from "../../../build/release.wasm_sections"
import { assert } from "../assert"
import { builtins } from "./builtins"

// Required as an immediate arg for all loads/stores.
const ALIGNMENT_AND_OFFSET = w.memarg(3 /* bits */, 0)

export function callBuiltin(name: string): w.BytecodeFragment {
  const idx = builtins.findIndex((fn) => fn.name === name)
  if (idx === -1) throw new Error(`builtin '${name}' not found`)
  return [w.instr.call, w.funcidx(prebuilt.importsec.entryCount + idx)]
}

export function f64_const(v: number) {
  return [w.instr.f64.const, w.f64(v)]
}

export function f64_load(offset: number) {
  return [
    [w.instr.i32.const, w.i32(offset)],
    [w.instr.f64.load, ALIGNMENT_AND_OFFSET],
  ]
}

export function f64_store(offset: number, frag: w.BytecodeFragment) {
  return [
    [w.instr.i32.const, w.i32(offset)],
    frag,
    [w.instr.f64.store, ALIGNMENT_AND_OFFSET],
  ]
}

export function i32_constexpr(value: number) {
  assert(value >>> 0 === value, "not a 32-bit integer")
  return [w.instr.i32.const, w.i32(value), w.instr.end]
}
