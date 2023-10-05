import fs from "node:fs"
import { extractCodeSection } from "./wasmmodule.ts"

const inputPath = "../build/release.wasm"
const inputUrl = new URL(inputPath, import.meta.url)
const outputUrl = new URL(inputPath + "_codesec.ts", import.meta.url)

const buf = fs.readFileSync(inputUrl)
const { entryCount, contents } = extractCodeSection(buf);

const base64Contents = JSON.stringify(Buffer.from(contents).toString('base64'));
const output = `export default {
  entryCount: ${JSON.stringify(entryCount)},
  contents: new Uint8Array(Buffer.from(${base64Contents}, 'base64'))
}
`
fs.writeFileSync(outputUrl, output, "utf8")
