// Note: these imports are shimmed in the prod build.
import * as fs from "node:fs"
import * as process from "node:process"

export const DEBUG = process.env?.KOMBU_DEBUG

const now = new Date().getTime()

export function DEBUG_writeFile(
  prefix: string,
  ext: string,
  data: string | Uint8Array,
) {
  if (DEBUG) {
    const filename = `${prefix}-${now}${ext}`
    fs.writeFileSync(filename, data)
  }
}
