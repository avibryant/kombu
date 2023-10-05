import fs from "node:fs"
import { extractCodesec } from "./extractCodesec"

/*
  Extracts the code section from the AssemblyScript release build
  and writes it to a .ts module in the same directory.
*/

const inputPath = "../build/release.wasm"
const inputUrl = new URL(inputPath, import.meta.url)
const outputUrl = new URL(inputPath + "_codesec.ts", import.meta.url)

const buf = fs.readFileSync(inputUrl)
const { entryCount, contents } = extractCodesec(buf)

const base64Contents = JSON.stringify(Buffer.from(contents).toString("base64"))
const output = `export default {
  entryCount: ${JSON.stringify(entryCount)},
  contents: new Uint8Array(Buffer.from(${base64Contents}, 'base64'))
}
`
fs.writeFileSync(outputUrl, output, "utf8")
