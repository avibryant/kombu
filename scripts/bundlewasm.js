import fs from "node:fs"

const inputPath = "../build/release.wasm"
const inputUrl = new URL(inputPath, import.meta.url)
const outputUrl = new URL(inputPath + ".js", import.meta.url)

const buf = fs.readFileSync(inputUrl)
const output = `export default new Uint8Array(Buffer.from(${JSON.stringify(
  buf.toString("base64"),
)}, 'base64'))`
fs.writeFileSync(outputUrl, output, "utf8")
