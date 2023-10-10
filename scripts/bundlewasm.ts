import fs from "node:fs"
import { extractFunctions } from "./extractFunctions.ts"

/*
  Extracts the code section from the AssemblyScript release build
  and writes it to a .ts module in the same directory.
*/

const inputPath = "../build/release.wasm"
const inputUrl = new URL(inputPath, import.meta.url)
const outputUrl = new URL(inputPath + "_sections.ts", import.meta.url)

const buf = fs.readFileSync(inputUrl)
const sections = extractFunctions(buf)

let output = ""
for (const [secName, { entryCount, contents }] of Object.entries(sections)) {
  const base64Contents = JSON.stringify(
    Buffer.from(contents).toString("base64"),
  )
  output += `export const ${secName} = (() => {
  const bytes = atob(${base64Contents});
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buf[i] = bytes.charCodeAt(i);
  }
  return {
    entryCount: ${JSON.stringify(entryCount)},
    contents: Array.from(buf)
  }
})()
`
}
fs.writeFileSync(outputUrl, output, "utf8")
