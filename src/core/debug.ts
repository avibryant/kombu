// This import is shimmed in the prod build.
// In development mode in the browser, it resolves to an empty module.
import * as fs from "node:fs"

import { Module, pseudocode } from "./ir"

export const DEBUG = process.env.KOMBU_DEBUG === "true"

const now = new Date().getTime()

export function DEBUG_writeFile(
  prefix: string,
  ext: string,
  data: string | Uint8Array,
) {
  if (!DEBUG || !fs.writeFileSync) return
  const filename = `${prefix}-${now}${ext}`
  fs.writeFileSync(filename, data)
}

export function DEBUG_logIrModule(mod: Module, repr = pseudocode) {
  if (!DEBUG) return
  console.log("\n[L]")
  console.log(repr(mod.loss))
  mod.gradient.forEach((grad, p) => {
    console.log(`[dL/d${p.name}]`)
    console.log(repr(grad))
  })
}
