import * as w from "@wasmgroundup/emit"

import * as prebuilt from "../../../build/release.wasm_sections"
import { builtins } from "./builtins"
import { Expr as IrExpr, pseudocode } from "../ir"

type FragmentSource = IrExpr | string | null

export enum WasmType {
  Binary,
  Const,
  Load,
  Store,
  Call,
  Seq,
}

export type WasmInstr =
  | BinaryInstr
  | ConstInstr
  | LoadInstr
  | StoreInstr
  | CallInstr
export type WasmFragment = WasmInstr | WasmInstrSeq

export interface WasmInstrSeq {
  type: WasmType.Seq
  source: FragmentSource
  instrs: WasmFragment[]
}

export interface BinaryInstr {
  type: WasmType.Binary
  source: FragmentSource
  valtype: "i32" | "f64"
  op: "mul" | "add" | "sub"

  // These must be WasmFragment, and not WasmInstr, in order to handle calls
  // that take arguments.
  l: WasmFragment
  r: WasmFragment
}

export interface ConstInstr {
  type: WasmType.Const
  source: FragmentSource
  valtype: "i32" | "f64"
  value: number
}

export interface LoadInstr {
  type: WasmType.Load
  source: FragmentSource
  valtype: "f64"
  addr: WasmInstr
}

export interface StoreInstr {
  type: WasmType.Store
  source: FragmentSource
  valtype: "f64"
  addr: WasmInstr
  // This must be WasmFragment, and not WasmInstr, in order to handle calls
  // that take arguments.
  expr: WasmFragment
}

export interface CallInstr {
  type: WasmType.Call
  source: FragmentSource
  funcidx: number
  name: string
}

// Required as an immediate arg for all loads/stores.
const ALIGNMENT_AND_OFFSET: number[] = w.memarg(3 /* bits */, 0).flat(1)

export function callBuiltin(source: FragmentSource, name: string): CallInstr {
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

export function i32_const(source: FragmentSource, v: number): ConstInstr {
  return { type: WasmType.Const, source, valtype: "i32", value: v }
}

export function f64_const(source: FragmentSource, v: number): ConstInstr {
  return { type: WasmType.Const, source, valtype: "f64", value: v }
}

export function f64_binOp(
  source: FragmentSource,
  op: BinaryInstr["op"],
  l: WasmFragment,
  r: WasmFragment,
): BinaryInstr {
  return {
    type: WasmType.Binary,
    source,
    valtype: "f64",
    op,
    l,
    r,
  }
}

export function f64_load(source: FragmentSource, offset: number): LoadInstr {
  return {
    type: WasmType.Load,
    source,
    valtype: "f64",
    addr: i32_const(null, offset),
  }
}

export function f64_store(
  source: FragmentSource,
  offset: number,
  expr: WasmFragment,
): StoreInstr {
  return {
    type: WasmType.Store,
    source,
    valtype: "f64",
    addr: i32_const("store addr", offset),
    expr,
  }
}

export function seq(
  source: FragmentSource,
  ...instrs: WasmFragment[]
): WasmInstrSeq {
  return {
    type: WasmType.Seq,
    source,
    instrs,
  }
}

function prettySource(source: FragmentSource) {
  if (source == null) return ""
  const str = typeof source === "string" ? source : pseudocode(source)
  return `(; ${str} ;)`
}

export function prettyPrint(frag: WasmFragment): string {
  const srcInfo = prettySource(frag.source)

  // Join lines, discard the first one if it's empty.
  const joinLines = (info: string, ...rest: string[]) =>
    (info === "" ? rest : [info, ...rest]).join("\n")

  switch (frag.type) {
    case WasmType.Const:
      // Ignore srcInfo, as it's not useful for const.
      return `${frag.valtype}.const ${frag.value}`
    case WasmType.Binary:
      return joinLines(
        srcInfo,
        prettyPrint(frag.l),
        prettyPrint(frag.r),
        `${frag.valtype}.${frag.op}`,
      )
    case WasmType.Load:
      return joinLines(
        srcInfo,
        prettyPrint(frag.addr),
        `${frag.valtype}.load {${ALIGNMENT_AND_OFFSET}}`,
      )
    case WasmType.Store:
      return joinLines(
        srcInfo,
        prettyPrint(frag.addr),
        prettyPrint(frag.expr),
        `${frag.valtype}.store {${ALIGNMENT_AND_OFFSET}}`,
      )
    case WasmType.Call:
      return `call $${frag.funcidx} (${frag.name})`
    case WasmType.Seq:
      return joinLines(srcInfo, ...frag.instrs.flatMap(prettyPrint))
  }
}

export function toBytes(frag: WasmFragment): number[] {
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
