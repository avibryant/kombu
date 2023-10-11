import fs from "node:fs"

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
