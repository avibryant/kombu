import * as w from "@wasmgroundup/emit"

import { checkNotNull } from "../assert"
import { BuiltinFunction } from "./builtins"

import prebuiltCodesec from "../../../build/release.wasm_codesec"

const WASM_PAGE_SIZE = 65536

// Signature for the externally-defined `optimize` function.
// TODO: Parse this from the prebuilt module.
const OPTIMIZE_FUNCTYPE = w.functype(
  [w.valtype.i32, w.valtype.i32, w.valtype.f64, w.valtype.f64, w.valtype.f64],
  [],
)

interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: w.BytecodeFragment
}

// Wasm modules have a separate section for function types, and function
// declarations use an index into that section.
// This creates a mapping from function type to typeidx.
function functypeIndex(types: w.BytecodeFragment[]) {
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
      return w.typeidx(idx)
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
  const functypes = functypeIndex([
    // This must be the first recorded type — it's implicitly used for any
    // `call_indirect` in the prebuilt AssemblyScript code.
    // TODO: Find a cleaner way to do this.
    w.functype([], [w.valtype.f64]),
    ...builtinFunctions.map(({ type }) => type),
    ...functions.map(({ type }) => type),
    OPTIMIZE_FUNCTYPE,
  ])

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
  const userFuncIdx = (idx: number) => builtinFunctions.length + idx

  const exports: w.BytecodeFragment = []
  functions.forEach(({ name }, i) => {
    if (name) exports.push(w.export_(name, w.exportdesc.func(userFuncIdx(i))))
  })
  // Export the externally-defined `optimize` function.
  exports.push(
    w.export_("optimize", w.exportdesc.func(userFuncIdx(functions.length))),
  )

  const funcsec = [
    ...functions.map(({ type }) => functypes.typeidx(type)),
    functypes.typeidx(OPTIMIZE_FUNCTYPE),
  ]

  // Produce a code section combining `codeEls` with the prebuilt code.
  const codesecWithPrebuilt = (codeEls: w.BytecodeFragment) => {
    const count = prebuiltCodesec.entryCount + codeEls.length
    return w.section(10, [
      w.u32(count),
      codeEls,
      Array.from(prebuiltCodesec.contents),
    ])
  }

  const fragment = w.module([
    w.typesec(functypes.typesec()),
    w.importsec(imports),
    w.funcsec(funcsec),
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
    codesecWithPrebuilt(
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
