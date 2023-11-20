// This import is shimmed in the prod build.
// In development mode in the browser, it resolves to an empty module.
import * as fs from "node:fs"

import * as i from "./wasm/instr"
import { Module, pseudocode } from "./ir"

const channels: Set<string> = new Set(
  (process.env.KOMBU_DEBUG ?? "").split(","),
)

const DEBUG_WASM = channels.has("wasm")
const DEBUG_IR = channels.has("ir")

const now = () => new Date().getTime()

export function DEBUG_writeFile(
  prefix: string,
  ext: string,
  data: string | Uint8Array,
) {
  if (!DEBUG_WASM || !fs.writeFileSync) return
  const filename = `${prefix}-${now()}${ext}`
  fs.writeFileSync(filename, data)
  console.log(`[KOMBU] wrote ${filename}`)
}

export function DEBUG_logIrModule(mod: Module, repr = pseudocode) {
  if (!DEBUG_IR) return
  console.log("\n[L]")
  console.log(repr(mod.loss))
  mod.gradient.forEach((grad, p) => {
    console.log(`[∂L/∂${p.name}]`)
    console.log(repr(grad))
  })
}

export function DEBUG_logWasm(funcidx: number, code: i.WasmFragment) {
  if (!DEBUG_WASM) return
  console.log(`\n[function #${funcidx}]`)
  console.log(i.prettyPrint(code))
}
