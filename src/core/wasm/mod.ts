import * as w from "@wasmgroundup/emit"

import { checkNotNull } from "../assert"
import { BuiltinFunction } from "./builtins"

import * as prebuilt from "../../../build/release.wasm_sections"

// https://webassembly.github.io/spec/core/bikeshed/index.html#sections%E2%91%A0
const SECTION_ID_TYPE = 1
const SECTION_ID_FUNCTION = 3
const SECTION_ID_CODE = 10

const WASM_PAGE_SIZE = 65536

interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: w.BytecodeFragment
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
  builtinFunctions: BuiltinFunction[],
  functions: WasmFunction[],
  memory: WebAssembly.Memory,
) {
  const functypes = functypeIndex(
    [
      ...builtinFunctions.map(({ type }) => type),
      ...functions.map(({ type }) => type),
    ],
    prebuilt.typesec.entryCount,
  )

  const imports = builtinFunctions.map(({ name, type }) => {
    const typeIdx = functypes.typeidx(type)
    return w.import_("builtins", name, [w.importdesc.func(typeIdx)])
  })
  const memorySize = memory.buffer.byteLength / WASM_PAGE_SIZE
  imports.push(
    w.import_(
      "memory",
      "cache",
      w.importdesc.mem(w.memtype(w.limits.min(memorySize))),
    ),
  )

  // Go from a "user" function index (0: loss function, 1...n: gradients)
  // to the actual index in the module.
  const userFuncIdx = (idx: number) =>
    builtinFunctions.length + prebuilt.codesec.entryCount + idx

  const exports: w.BytecodeFragment = []
  functions.forEach(({ name }, i) => {
    if (name) exports.push(w.export_(name, w.exportdesc.func(userFuncIdx(i))))
  })
  // Export the externally-defined `optimize` function.
  // TODO: Look up the correct index in the prebuilt module.
  exports.push(w.export_("optimize", w.exportdesc.func(userFuncIdx(-1))))

  const fragment = w.module([
    mergeSections(SECTION_ID_TYPE, prebuilt.typesec, functypes.typesec()),
    w.importsec(imports),
    mergeSections(
      SECTION_ID_FUNCTION,
      prebuilt.funcsec,
      functions.map(({ type }) => functypes.typeidx(type)),
    ),
    w.tablesec([
      w.table(w.tabletype(w.elemtype.funcref, w.limits.min(functions.length))),
    ]),
    w.exportsec(exports),
    // Initialize the table
    w.elemsec([
      w.elem(
        w.tableidx(0),
        [w.instr.i32.const, 0, w.instr.end],
        functions.map((_, i) => w.funcidx(userFuncIdx(i))),
      ),
    ]),
    mergeSections(
      SECTION_ID_CODE,
      prebuilt.codesec,
      functions.map(({ body }) => w.code(w.func([], [...body, w.instr.end]))),
    ),
  ])
  //  debugPrint(bytes)
  // `(mod as any[])` to avoid compiler error about excessively deep
  // type instantiation.
  const bytes = Uint8Array.from((fragment as any[]).flat(Infinity))

  //  fs.writeFileSync("module.wasm", bytes)
  const mod = new WebAssembly.Module(bytes)
  return new WebAssembly.Instance(mod, {
    builtins: Object.fromEntries(
      builtinFunctions.map(({ name, impl }) => [name, impl]),
    ),
    memory: { cache: memory },
  })
}
