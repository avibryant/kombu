import fs from "node:fs"
import { basename } from 'node:path'

import { assert } from "../src/core/assert"
import { builtins } from "../src/core/wasm/builtins"
import { extractSections } from "./modparse"

/*
  Extracts the code section from the AssemblyScript release build
  and writes it to a .ts module in the same directory.
*/

// Because we manually rewrite the global section, we make sure that the bytes
// are exactly what we're expecting. If you've made changes to the
// AssemblyScript code and the globals have changed, you should:
// 1. Make sure the code in instantiateModule() writes the globals correctly.
// 2. Change the value of this constant to reflect the new expectation.
const GLOBALSEC_CONTENTS = "fwFBAAt/AUEAC38AQQALfwBBAQt/AEECC38AQewCCw=="

const inputPath = "../build/release.wasm"
const inputUrl = new URL(inputPath, import.meta.url)
const outputUrl = new URL(inputPath + "_sections.ts", import.meta.url)

const buf = fs.readFileSync(inputUrl)
const sections = extractSections(buf, {
  destImportCount: builtins.length,
})

const { globalsec } = sections
const toBase64 = (arr: Uint8Array) => Buffer.from(arr).toString('base64')
assert(toBase64(globalsec.contents) === GLOBALSEC_CONTENTS,
  `Oh no. Unexpected globalsec contents: "${toBase64(globalsec.contents)}"
See ${basename(import.meta.url)} for more details.`)

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
