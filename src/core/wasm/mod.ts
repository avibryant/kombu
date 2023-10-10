import * as w from "@wasmgroundup/emit"

import { checkNotNull } from "../assert"

import prebuiltCodesec from "../../../build/release.wasm_codesec"

const WASM_PAGE_SIZE = 65536

function frag(dbg: string, ...fragment: w.BytecodeFragment) {
  const arr = Array.from(fragment)
  ;(arr as any).dbg = dbg
  return arr
}

export interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: w.BytecodeFragment
}

interface BuiltinFunction {
  name: string
  type: w.BytecodeFragment
  impl: Function
}

class Functypes {
  funcidxByType = new Map<string, number>()
  functypes: w.BytecodeFragment = []

  typeidxForFunctype(type: w.BytecodeFragment): w.BytecodeFragment {
    const idx = checkNotNull(this.funcidxByType.get(JSON.stringify(type)))
    return w.typeidx(idx)
  }

  recordFunctype(type: w.BytecodeFragment): number {
    const k = JSON.stringify(type)
    if (this.funcidxByType.has(k)) {
      return this.funcidxByType.get(k)!
    }
    const idx = this.funcidxByType.size
    this.funcidxByType.set(k, idx)
    this.functypes.push(type)
    return idx
  }
}

export function instantiateModule(
  builtinFunctions: BuiltinFunction[],
  functions: WasmFunction[],
  memory: WebAssembly.Memory,
) {
  const ctx = new Functypes()

  // This must be the first recorded type — it's implicitly used for any
  // `call_indirect` in the prebuilt AssemblyScript code.
  // TODO: Find a cleaner way to do this.
  ctx.recordFunctype(w.functype([], [w.valtype.f64]))
  functions.forEach(({ type }) => ctx.recordFunctype(type))

  const imports = builtinFunctions.map(({ name, type }) => {
    const typeIdx = ctx.recordFunctype(type)
    return frag(
      "import" + name,
      w.import_(
        "builtins",
        name,
        frag("importdesc" + name, w.importdesc.func(w.typeidx(typeIdx))),
      ),
    )
  })

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

  const funcsec = functions.map(({ type }) =>
    w.typeidx(ctx.recordFunctype(type)),
  )

  // Append an entry for the externally-defined `optimize` function.
  funcsec.push(
    w.typeidx(
      ctx.recordFunctype(
        w.functype(
          [
            w.valtype.i32,
            w.valtype.i32,
            w.valtype.f64,
            w.valtype.f64,
            w.valtype.f64,
          ],
          [],
        ),
      ),
    ),
  )

  const funcCount = functions.length

  // Produce a code section combining `codeEls` with the prebuilt code.
  const codesecWithPrebuilt = (codeEls: w.BytecodeFragment) => {
    const count = prebuiltCodesec.entryCount + codeEls.length
    return w.section(10, [
      w.u32(count),
      codeEls,
      Array.from(prebuiltCodesec.contents),
    ])
  }

  const memorySize = memory.buffer.byteLength / WASM_PAGE_SIZE
  imports.push(
    w.import_(
      "memory",
      "cache",
      w.importdesc.mem(w.memtype(w.limits.min(memorySize))),
    ),
  )

  const fragment = w.module([
    w.typesec(ctx.functypes),
    w.importsec(imports),
    w.funcsec(funcsec),
    w.tablesec([
      w.table(
        w.tabletype(w.elemtype.funcref, w.limits.minmax(funcCount, funcCount)),
      ),
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
      functions.map(({ body }) =>
        w.code(w.func([], frag("code", ...body, w.instr.end))),
      ),
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
