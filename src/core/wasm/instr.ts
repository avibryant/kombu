import * as w from "@wasmgroundup/emit"

import * as prebuilt from "../../../build/release.wasm_sections"
import { builtins } from "./builtins"

export enum WasmType {
  Binary,
  Const,
  Load,
  Store,
  Call,
  Seq,
}

export type WasmInstr<T> =
  | BinaryInstr<T>
  | ConstInstr<T>
  | LoadInstr<T>
  | StoreInstr<T>
  | CallInstr<T>
export type WasmFragment<T> = WasmInstr<T> | WasmInstrSeq<T>

export interface WasmInstrSeq<T> {
  type: WasmType.Seq
  source: T
  instrs: WasmFragment<T>[]
}

export interface BinaryInstr<T> {
  type: WasmType.Binary
  source: T
  valtype: "i32" | "f64"
  op: "mul" | "add"

  // These must be WasmFragment, and not WasmInstr, in order to handle calls
  // that take arguments.
  l: WasmFragment<T>
  r: WasmFragment<T>
}

export interface ConstInstr<T> {
  type: WasmType.Const
  source: T
  valtype: "i32" | "f64"
  value: number
}

export interface LoadInstr<T> {
  type: WasmType.Load
  source: T
  valtype: "f64"
  addr: WasmInstr<T>
}

export interface StoreInstr<T> {
  type: WasmType.Store
  source: T
  valtype: "f64"
  addr: WasmInstr<T>
  // This must be WasmFragment, and not WasmInstr, in order to handle calls
  // that take arguments.
  expr: WasmFragment<T>
}

export interface CallInstr<T> {
  type: WasmType.Call
  source: T
  funcidx: number
  name: string
}

// Required as an immediate arg for all loads/stores.
const ALIGNMENT_AND_OFFSET: number[] = w.memarg(3 /* bits */, 0).flat(1)

export function callBuiltin<T>(source: T, name: string): CallInstr<T> {
  const idx =
    builtins.findIndex((fn) => fn.name === name) + prebuilt.importsec.entryCount
  if (idx === -1) throw new Error(`builtin '${name}' not found`)
  return {
    type: WasmType.Call,
    source,
    funcidx: idx,
    name,
  }
}

export function i32_const<T>(source: T, v: number): ConstInstr<T> {
  return { type: WasmType.Const, source, valtype: "i32", value: v }
}

export function f64_const<T>(source: T, v: number): ConstInstr<T> {
  return { type: WasmType.Const, source, valtype: "f64", value: v }
}

export function f64_binOp<T>(
  source: T,
  op: BinaryInstr<T>["op"],
  l: WasmFragment<T>,
  r: WasmFragment<T>,
): BinaryInstr<T> {
  return {
    type: WasmType.Binary,
    source,
    valtype: "f64",
    op,
    l,
    r,
  }
}

export function f64_load<T>(source: T, offset: number): LoadInstr<T> {
  return {
    type: WasmType.Load,
    source,
    valtype: "f64",
    // TODO: What to do about source?
    addr: i32_const<T>(source, offset),
  }
}

export function f64_store<T>(
  source: T,
  offset: number,
  expr: WasmFragment<T>,
): StoreInstr<T> {
  return {
    type: WasmType.Store,
    source,
    valtype: "f64",
    addr: i32_const<T>(source, offset),
    expr,
  }
}

export function seq<T>(
  source: T,
  ...instrs: WasmFragment<T>[]
): WasmInstrSeq<T> {
  return {
    type: WasmType.Seq,
    source,
    instrs,
  }
}

export function prettyPrint<T>(frag: WasmFragment<T>): string {
  switch (frag.type) {
    case WasmType.Const:
      return `${frag.valtype}.const ${frag.value}`
    case WasmType.Binary:
      return [
        prettyPrint(frag.l),
        prettyPrint(frag.r),
        `${frag.valtype}.${frag.op}`,
      ].join("\n")
    case WasmType.Load:
      return [
        prettyPrint(frag.addr),
        `${frag.valtype}.load {${ALIGNMENT_AND_OFFSET}}`,
      ].join("\n")
    case WasmType.Store:
      return [
        prettyPrint(frag.addr),
        prettyPrint(frag.expr),
        `${frag.valtype}.store {${ALIGNMENT_AND_OFFSET}}`,
      ].join("\n")
    case WasmType.Call:
      return `call $${frag.funcidx} (${frag.name})`
    case WasmType.Seq:
      return frag.instrs.flatMap(prettyPrint).join("\n")
  }
}

export function toBytes<T>(frag: WasmFragment<T>): number[] {
  switch (frag.type) {
    case WasmType.Const:
      return frag.valtype === "f64"
        ? [w.instr.f64.const, ...w.f64(frag.value)]
        : [w.instr.i32.const, ...w.i32(frag.value)]
    case WasmType.Binary:
      return [
        toBytes(frag.l),
        toBytes(frag.r),
        w.instr[frag.valtype][frag.op],
      ].flat(3)
    case WasmType.Load:
      return [
        toBytes(frag.addr),
        [w.instr.f64.load, ALIGNMENT_AND_OFFSET],
      ].flat(3)
    case WasmType.Store:
      return [
        toBytes(frag.addr),
        toBytes(frag.expr),
        [w.instr.f64.store, ALIGNMENT_AND_OFFSET],
      ].flat(3)
    case WasmType.Call:
      return [w.instr.call, ...w.funcidx(frag.funcidx)]
    case WasmType.Seq:
      return frag.instrs.flatMap(toBytes)
  }
}
