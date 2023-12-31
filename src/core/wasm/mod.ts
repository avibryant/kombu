// import * as fs from "node:fs"

import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "../assert"
import { DEBUG_logWasm, DEBUG_writeFile } from "../debug"
import { builtins } from "./builtins"
import * as i from "./instr"
import { traceImpl } from "./trace"

import * as prebuilt from "../../../build/release.wasm_sections"

// https://webassembly.github.io/spec/core/bikeshed/index.html#sections%E2%91%A0
const SECTION_ID_TYPE = 1
const SECTION_ID_IMPORT = 2
const SECTION_ID_FUNCTION = 3
const SECTION_ID_GLOBAL = 6
const SECTION_ID_CODE = 10

const WASM_PAGE_SIZE = 65536

interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: i.WasmFragment
}

interface PrebuiltSection {
  entryCount: number
  contents: number[]
}

// Produce a section combining `els` with the corresponding prebuilt section.
// This only does a naive merge; no type or function indices are rewritten.
function mergeSections(
  sectionId: number,
  prebuilt: PrebuiltSection,
  els: w.BytecodeFragment,
) {
  const count = prebuilt.entryCount + els.length
  return w.section(sectionId, [w.u32(count), prebuilt.contents, els])
}

// Wasm modules have a separate section for function types, and function
// declarations use an index into that section.
// This creates a mapping from function type to typeidx. `startIdx`
// specifies indices that should be reserved at the beginning.
function functypeIndex(types: w.BytecodeFragment[], startIdx: number) {
  const typeToString = (t: w.BytecodeFragment) => JSON.stringify(t)

  const typeidxByString = new Map<string, number>()
  const uniqueTypes: w.BytecodeFragment[] = []

  for (const t of types) {
    const k = typeToString(t)
    if (!typeidxByString.has(k)) {
      typeidxByString.set(k, uniqueTypes.length)
      uniqueTypes.push(t)
    }
  }

  return {
    // Return the typeidx for the given type `t`.
    typeidx(t: w.BytecodeFragment): w.BytecodeFragment {
      const idx = checkNotNull(typeidxByString.get(typeToString(t)))
      return w.typeidx(idx + startIdx)
    },
    // Return a valid typesec for the module.
    typesec() {
      return uniqueTypes
    },
  }
}

export function instantiateModule(
  functions: WasmFunction[],
  memory: WebAssembly.Memory,
  cacheSizeBytes: number,
) {
  const functypes = functypeIndex(
    [...builtins.map(({ type }) => type), ...functions.map(({ type }) => type)],
    prebuilt.typesec.entryCount,
  )

  const imports = builtins.map(({ name, type }) => {
    const typeIdx = functypes.typeidx(type)
    return w.import_("builtins", name, [w.importdesc.func(typeIdx)])
  })
  const memorySize = memory.buffer.byteLength
  const numPages = Math.ceil(memorySize / WASM_PAGE_SIZE)
  imports.push(
    w.import_(
      "memory",
      "cache",
      w.importdesc.mem(w.memtype(w.limits.min(numPages))),
    ),
  )

  const importCount = prebuilt.importsec.entryCount + builtins.length

  // Go from a "user" function index (0: loss function, 1...n: gradients)
  // to the actual index in the module.
  const userFuncIdx = (idx: number) =>
    importCount + prebuilt.codesec.entryCount + idx

  const exports: w.BytecodeFragment = []
  functions.forEach(({ name }, i) => {
    if (name) exports.push(w.export_(name, w.exportdesc.func(userFuncIdx(i))))
  })
  // Export the externally-defined `optimize` functions.
  // TODO: Look up the correct indices in the prebuilt module.
  exports.push(w.export_("optimizeLBFGS", w.exportdesc.func(userFuncIdx(-4))))
  exports.push(
    w.export_("optimizeGradientDescent", w.exportdesc.func(userFuncIdx(-3))),
  )
  exports.push(
    w.export_("evaluateLossForTesting", w.exportdesc.func(userFuncIdx(-2))),
  )

  // AssemblyScript's memory manager uses the __heap_base global as the
  // beginning of its heap. Rewrite that value to account for the memory
  // that we are manually managing (for the params and optimizer cache).
  // Ensure it's >= 128 so that the encoded value is at two bytes.
  const heapBase = w.u32(Math.max(128, cacheSizeBytes))
  assert(heapBase.length === 2, "expected two bytes")
  const newGlobalsec = {
    contents: [
      ...prebuilt.globalsec.contents.slice(0, -3),
      ...heapBase,
      w.instr.end,
    ],
    entryCount: prebuilt.globalsec.entryCount,
  }

  const codesec = functions.map(({ body }, idx) => {
    DEBUG_logWasm(userFuncIdx(idx), body)
    const bytecode = i.toBytes(body)
    return w.code(w.func([], [...bytecode, w.instr.end]))
  })

  const fragment = w.module([
    mergeSections(SECTION_ID_TYPE, prebuilt.typesec, functypes.typesec()),
    mergeSections(SECTION_ID_IMPORT, prebuilt.importsec, imports),
    mergeSections(
      SECTION_ID_FUNCTION,
      prebuilt.funcsec,
      functions.map(({ type }) => functypes.typeidx(type)),
    ),
    w.tablesec([
      w.table(w.tabletype(w.elemtype.funcref, w.limits.min(functions.length))),
    ]),
    mergeSections(SECTION_ID_GLOBAL, newGlobalsec, []),
    w.exportsec(exports),
    w.startsec(w.funcidx(userFuncIdx(-1))),
    // Initialize the table
    w.elemsec([
      w.elem(
        w.tableidx(0),
        [w.instr.i32.const, 0, w.instr.end],
        functions.map((_, i) => w.funcidx(userFuncIdx(i))),
      ),
    ]),
    mergeSections(SECTION_ID_CODE, prebuilt.codesec, codesec),
  ])
  //  debugPrint(bytes)
  // `(mod as any[])` to avoid compiler error about excessively deep
  // type instantiation.
  const bytes = Uint8Array.from((fragment as any[]).flat(Infinity))

  DEBUG_writeFile("module", ".wasm", bytes)

  const mod = new WebAssembly.Module(bytes)
  return new WebAssembly.Instance(mod, {
    builtins: Object.fromEntries(
      builtins.map(({ name, impl }) => [name, impl]),
    ),
    memory: { cache: memory },
    env: {
      "console.log": console.log,
      // Copied with modification from the release.js generated by AssemblyScript.
      // TODO: Copy the data section from the AssemblyScript module, so that
      // we actually have access to the static string data.
      abort(
        message: number,
        fileName: number,
        lineNumber: number,
        columnNumber: number,
      ) {
        const __liftString = (x: number) => x // Ignore the string, return the number
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0)
        fileName = __liftString(fileName >>> 0)
        lineNumber = lineNumber >>> 0
        columnNumber = columnNumber >>> 0
        ;(() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`)
        })()
      },
      ...traceImpl(true),
    },
  })
}

export function callSafely(
  exports: WebAssembly.Exports,
  name: string,
  ...args: number[]
) {
  assert(
    typeof exports[name] === "function",
    `export '${name}' not found or not callable`,
  )
  return (exports as any)[name].apply(null, args)
}
