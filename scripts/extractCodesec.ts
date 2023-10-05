import { assert, checkNotNull } from "../src/core/assert.ts"

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

export type VecContents = {
  entryCount: number
  contents: Uint8Array
}

function getModuleFunctions(bytes: Uint8Array) {
  checkPreamble(bytes)

  function peekSectionId(): number {
    return bytes[pos]
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
    const entryCount = parseU32()
    const contents = bytes.slice(pos, end)
    pos = end
    return { entryCount, contents }
  }

  let typesec: VecContents | undefined = undefined
  let functionsec: VecContents | undefined = undefined
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
    } else if (id === 3) {
      functionsec = parseSectionOpaque(id)
    } else if (id === 10) {
      codesec = parseSectionOpaque(id)
    } else {
      skipSection()
    }
  }
  return {
    typesec: checkNotNull(typesec),
    functionsec: checkNotNull(functionsec),
    codesec: checkNotNull(codesec),
  }
}

// Extracts the code section from the Wasm module in `bytes`.
export function extractCodesec(bytes: Uint8Array): VecContents {
  const { codesec } = getModuleFunctions(bytes)
  return codesec
}
