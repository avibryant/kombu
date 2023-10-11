import { assert, checkNotNull } from "../src/core/assert.ts"
import * as w from "@wasmgroundup/emit"

// For sanity checking, assume that the number of locals is never
// above a certain number. (We can raise this if necessary.)
const MAX_LOCALS = 50;

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

function checkValtype(t: number): number {
  assert(
    (0x7c <= t && t <= 0x7f) || // numtype
      t === 0x7b || // vectype
      (0x6f <= t && t <= 0x70), // reftype
    `unrecognized valtype: 0x${t.toString(2)}`,
  )
  return t
}

function checkU32(b: bigint): number {
  assert(b >= 0n && b < 2n**32n, `not a valid U32 value: ${b}`);
  return Number(b);
}

// Parse a LEB128-encoded value (u32 or u34).
// Return [val, count], where `val` is the decoded value, and `count`
// is the number of bytes it was encoded with.
function parseULEB128(
  arr: Uint8Array | number[],
  start: number,
): [bigint, number] {
  let result = 0n
  let pos = start
  for (let i = 0; i < 8; i++) {
    const b = arr[pos++]
    result |= BigInt((b & 0b01111111) << (i * 7))
    if (b < 0b10000000) break
  }
  return [result, pos - start]
}

export type VecContents = {
  entryCount: number
  contents: Uint8Array
}

interface ExtractOptions {
  destImportCount?: number,
}

// Extracts the type, import, function, and code sections from a Wasm module.
export function extractSections(bytes: Uint8Array, opts: ExtractOptions={}) {
  checkPreamble(bytes)

  const parseU32 = () => {
    const [val, count] = parseULEB128(bytes, pos)
    pos += count
    return checkU32(val)
  }

  function peekSectionId(): number {
    return bytes[pos]
  }

  function skipSection() {
    // @ts-ignore unused variable
    const id = bytes[pos++]
    const size = parseU32()
    pos += size
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
    const entryCount = parseU32()
    const contents = bytes.slice(pos, end)
    pos = end
    return { entryCount, contents }
  }

  let typesec: VecContents | undefined = undefined
  let importsec: VecContents = { entryCount: 0, contents: new Uint8Array() }
  let funcsec: VecContents | undefined = undefined
  let codesec: VecContents | undefined = undefined

  let pos = 8
  let lastId = -1
  while (pos < bytes.length) {
    const id = peekSectionId()
    // Custom sections (id 0) can appear anywhere. Also, the data count
    // section (id 12) appears just before the code section (id 10).
    // All other sections must appear in the prescribed order.
    assert(
      id === 0 || lastId < id || (lastId === 12 && id === 10),
      `@${pos} expected id > ${lastId}, got ${id}`,
    )
    lastId = id
    if (id === 1) {
      typesec = parseSectionOpaque(id)
    } else if (id === 2) {
      importsec = parseSectionOpaque(id)
    } else if (id === 3) {
      funcsec = parseSectionOpaque(id)
    } else if (id === 10) {
      codesec = parseSectionOpaque(id)
      // Rewrite the code section to account for the number of imports that
      // will exist in the final module.
      const srcImportCount = importsec?.entryCount ?? 0
      const destImportCount = opts.destImportCount ??  0
      codesec.contents = rewriteCodesecContents(codesec.contents, srcImportCount, destImportCount)
    } else {
      skipSection()
    }
  }
  return {
    typesec: checkNotNull(typesec),
    importsec,
    funcsec: checkNotNull(funcsec),
    codesec: checkNotNull(codesec),
  }
}

function rewriteCodeEntry(
  bytes: Uint8Array | number[],
  srcImportCount: number,
  destImportCount: number
): number[] {
  console.log('rewriteCodeEntry');
  const { instr } = w
  let pos = 0

  const parseU32 = () => {
    const [val, count] = parseULEB128(bytes, pos)
    pos += count
    return checkU32(val)
  }

  function parseLocals() {
    const len = parseU32()
    for (let i = 0; i < len; i++) {
      const count = parseU32()
      assert(count < MAX_LOCALS, `too many locals: ${count} @${pos}`)
      checkValtype(bytes[pos++])
    }
  }

  parseLocals()

  const result: number[] = []
  let sliceStart = 0

  while (pos < bytes.length) {
    const bc = bytes[pos++]

    // The cases here are ordered by ascending opcode.
    // See https://pengowray.github.io/wasm-ops/ for an overview.
    switch (bc) {
      case instr.block:
      case instr.loop:
      case instr.if:
        pos++
        break
      case instr.end:
        break
      case instr.br:
      case instr.br_if:
        parseU32()
        break
      case instr.br_table:
        throw new Error(`unhandled bytecode 0x${bc.toString(16)} @${pos - 1}`)
      case instr.return:
        break
      case instr.call:
        // Rewrite `call` instructions so that the index is valid for the
        // target module.
        result.push(...bytes.slice(sliceStart, pos));
        let idx = parseU32()

        // Function indices in a Wasm bundle are automatically assigned.
        // First come the imports, then the user-defined functions.
        // Since the dest module has additional imports, we need to rewrite
        // the funcidx if and only if it referred to a user function.
        if (idx >= srcImportCount) {
          idx += destImportCount;
        }
        result.push(...w.u32(idx))
        sliceStart = pos
        break
      case instr.call_indirect:
        parseU32()
        parseU32()
        break
      case instr.drop:
        break
      case instr.local.get:
      case instr.local.set:
      case instr.local.tee:
      case instr.global.get:
      case instr.global.set:
        parseU32()
        break
      case instr.i32.const:
        parseU32()
        break
      case instr.i64.const:
        const [_, count] = parseULEB128(bytes, pos)
        assert(count <= 8, `too many bytes (${count}) for i64`)
        break
      case instr.f32.const:
        pos += 4
        break
      case instr.f64.const:
        pos += 8
        break
      default:
        if (instr.i32.load <= bc && bc <= instr.i64.store32) {
          // loads & stores
          parseU32()
          parseU32()
        } else if (
          (instr.memory.size <= bc && bc <= instr.memory.grow) ||
          (instr.i32.eqz <= bc && bc <= instr.f64.reinterpret_i64)
        ) {
          // do nothing
        } else {
          throw new Error(`unhandled bytecode 0x${bc.toString(16)} @${pos - 1}`)
        }
        break
    }
  }
  result.push(...bytes.slice(sliceStart))
  return result;
}

function rewriteCodesecContents(bytes: Uint8Array, srcImportCount: number, destImportCount: number): Uint8Array {
  let pos = 0

  const parseU32 = () => {
    const [val, count] = parseULEB128(bytes, pos)
    pos += count
    return checkU32(val)
  }

  const newBytes: number[] = []

  while (pos < bytes.length) {
    const size = parseU32()
    const newEntry = rewriteCodeEntry(bytes.slice(pos, pos + size), srcImportCount, destImportCount)
    newBytes.push(...w.u32(newEntry.length), ...newEntry)
    pos += size
  }

  return new Uint8Array(newBytes);
}
