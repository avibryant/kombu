import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "./assert.ts"
import moduleTemplate from "../../build/release.wasm.js"

export interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: w.BytecodeFragment
}

function checkPreamble(bytes: Uint8Array): void {
  // prettier-ignore
  const expected = new Uint8Array([
    0, ...Array.from("asm").map((c) => checkNotNull(c.codePointAt(0))),
    1, 0, 0, 0,
  ])
  for (let i = 0; i < expected.length; i++) {
    assert(
      bytes[i] === expected[i],
      `bad preamble @${i}: expected ${expected[i]}, got ${bytes[i]}`,
    )
  }
}

function getModuleFunctions(bytes: Uint8Array) {
  checkPreamble(bytes)

  function peekSectionId(): number {
    return bytes[pos]
  }

  function parseSection<T>(parseContents: (size: number) => T) {
    const id = bytes[pos++]
    console.log("parsing section id ", id)
    const size = parseU32()
    const contents = parseContents(size)
    return { id, contents }
  }

  function skipSection() {
    // @ts-ignore unused variable
    const id = bytes[pos++]
    const size = parseU32()
    pos += size
  }

  // Parse a LEB128-encoded u32 value.
  function parseU32() {
    let result = 0
    for (let i = 0; i < 4; i++) {
      const b = bytes[pos++]
      result |= (b & 0b01111111) << (i * 7)
      if (b < 0b10000000) break
    }
    return result
  }

  function parseSectionOpaque(expectedId: number) {
    const id = bytes[pos++]
    assert(
      id === expectedId,
      `expected section with id ${expectedId}, got ${id}`,
    )
    const size = parseU32()
    return parseVecOpaque(size)
  }

  // Parse a vec without examining its contents.
  // Return the length (# of elements) and the raw contents.
  function parseVecOpaque(size: number) {
    const end = pos + size
    const len = parseU32()
    const contents = bytes.slice(pos, end)
    pos = end
    return { len, contents }
  }

  let typeSec
  let functionSec
  let codeSec

  let pos = 8
  let lastId = -1
  while (pos < bytes.length) {
    const id = peekSectionId()
    // Custom sections (id 0) can appear anywhere. All other sections must
    // appear in the prescribed order.
    assert(
      id === 0 || lastId < id || (lastId === 12 && id === 10),
      `@${pos} expected id > ${lastId}, got ${id}`,
    )
    lastId = id
    if (id === 1) {
      typeSec = parseSectionOpaque(id)
    } else if (id === 3) {
      functionSec = parseSectionOpaque(id)
    } else if (id === 10) {
      codeSec = parseSectionOpaque(id)
    } else {
      skipSection()
    }
  }
  return { typeSec, functionSec, codeSec }
}

function spliceVec(opaqueContents, len, myContents) {
  const arr = new Array(len)
  if (len > 0) {
    arr[0] = Array.from(opaqueContents)
  }
  arr.push(...myContents)
  return arr
}

export function getPrebuiltModuleContents() {
  return getModuleFunctions(moduleTemplate)
}

export class ModuleWriter {
  prebuilt = getModuleFunctions(moduleTemplate)

  typesec(functypes: w.BytecodeFragment): w.BytecodeFragment {
    const typeSec = checkNotNull(this.prebuilt.typeSec)
    const len = typeSec.len + functypes.length
    return w.section(1, [w.u32(len), functypes, Array.from(typeSec.contents)])
  }

  codesec(codes: w.BytecodeFragment): w.BytecodeFragment {
    const codeSec = checkNotNull(this.prebuilt.codeSec)
    const len = codeSec.len + codes.length
    const arr = Array.from(codeSec.contents)
    codes.dbg = `internal (len=${codes.flat(Infinity).length})`
    arr.dbg = `external (len=${codeSec.contents.length})`
    return w.section(10, [w.u32(len), codes, arr])
  }

  tablesec(tables: w.BytecodeFragment): w.BytecodeFragment {
    return w.section(4, w.vec(tables))
  }

  table(tt: w.BytecodeFragment) {
    return tt
  }

  // et:elemtype lim:limits
  tabletype(elemtype: number, limits: w.BytecodeFragment) {
    return [elemtype, limits]
  }

  limits(min: number, max?: number) {
    if (max === undefined) {
      return [0x00, w.u32(min)]
    }
    return [0x01, w.u32(min), w.u32(max)]
  }

  funcref = 0x70
}
