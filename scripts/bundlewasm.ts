import * as fs from "node:fs"
import * as w from "@wasmgroundup/emit"

import { assert } from "../src/core/assert"
import { builtins } from "../src/core/wasm/builtins"
import { extractSections } from "./modparse"

/*
  Extracts the code section from the AssemblyScript release build
  and writes it to a .ts module in the same directory.
*/

const inputPath = "../build/release.wasm"
const inputUrl = new URL(inputPath, import.meta.url)
const outputUrl = new URL(inputPath + "_sections.ts", import.meta.url)

const buf = fs.readFileSync(inputUrl)
const sections = extractSections(buf, {
  destImportCount: builtins.length,
})

// Expect the last global to represent the following:
//  (global $~lib/memory/__heap_base i32 (i32.const 364))
// Changes to the AssemblyScript source code may cause the constant to change.
// To avoid overwriting the wrong global, make sure the contents are exactly
// what we expect.
const expectedHeapBase = w.global(w.globaltype(w.valtype.i32, w.mut.const), [
  w.instr.i32.const,
  w.i32(364),
  w.instr.end,
])
const lastGlobal = Array.from(sections.globalsec.contents.slice(-6))

// If this assertion fails, check the globals defined in build/release.wat,
// and if necessary, update the i32 constant to reflect the new value.
assert(
  JSON.stringify(lastGlobal) ===
    JSON.stringify(expectedHeapBase.flat(Infinity)),
  "unexpected contents in last global variable",
)

let output = `function decodeBase64(str: string) {
  const bytes = atob(str)
  const result: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes.charCodeAt(i)
  }
  return result
}

`

for (const [secName, { entryCount, contents }] of Object.entries(sections)) {
  const base64Contents = Buffer.from(contents).toString("base64")
  output += `export const ${secName} = {
  entryCount: ${JSON.stringify(entryCount)},
  contents: decodeBase64(${JSON.stringify(base64Contents)})
}
`
}
fs.writeFileSync(outputUrl, output, "utf8")
