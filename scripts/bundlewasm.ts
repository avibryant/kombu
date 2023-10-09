import fs from "node:fs"
import { extractCodesec } from "./extractCodesec.ts"

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
const output = `const bytes = atob(${base64Contents});
const buf = new Uint8Array(bytes.length);
for (let i = 0; i < bytes.length; i++) {
  buf[i] = bytes.charCodeAt(i);
}
export default {
  entryCount: ${JSON.stringify(entryCount)},
  contents: buf
}
`
fs.writeFileSync(outputUrl, output, "utf8")
