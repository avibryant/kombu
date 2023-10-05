import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "./assert"
import * as t from "./types"

import prebuiltCodesec from '../../build/release.wasm_codesec';

const builtins = {
  log: Math.log,
  exp: Math.exp,
  pow: Math.pow,
  sign: Math.sign,
  abs: Math.abs,
  cos: Math.cos,
  sin: Math.sin,
  atan: Math.atan,
}
const builtinNames = Object.keys(builtins)

type IdentifiableNum = t.Num & { id: number }

export interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: w.BytecodeFragment
}

function f64_const(v: number): w.BytecodeFragment {
  return frag("f64_const", w.instr.f64.const, w.f64(v))
}

class CodegenContext {
  globals: { type: number; initExpr: w.BytecodeFragment | undefined }[] = []
  idToGlobalidx = new Map<number, number>()
  functypeToIdx = new Map<string, number>()
  functypes: w.BytecodeFragment = []

  allocateGlobal(num: IdentifiableNum, initialVal: number): number {
    const idx = this.globals.length
    this.idToGlobalidx.set(num.id, idx)

    this.globals.push({ type: w.valtype.f64, initExpr: f64_const(initialVal) })
    return idx
  }

  globalidx(num: IdentifiableNum): number {
    return this.idToGlobalidx.get(num.id) ?? -1
  }

  typeidxForFunctype(type: w.BytecodeFragment): w.BytecodeFragment {
    const idx = checkNotNull(this.functypeToIdx.get(JSON.stringify(type)))
    return w.typeidx(idx)
  }

  recordFunctype(type: w.BytecodeFragment): number {
    const k = JSON.stringify(type)
    if (this.functypeToIdx.has(k)) {
      console.log(k, this.functypeToIdx.get(k))
      return this.functypeToIdx.get(k)!
    }
    const idx = this.functypeToIdx.size
    this.functypeToIdx.set(k, idx)
    this.functypes.push(type)
    console.log(k, this.functypeToIdx.get(k))
    return idx
  }
}

function frag(dbg: string, ...fragment: w.BytecodeFragment) {
  const arr = Array.from(fragment)
  ;(arr as any).dbg = dbg
  return arr
}

let count = 0
// @ts-ignore 'debugPrint' is declared but its value is never read.
function debugPrint(frag: any[], depth = 0) {
  const log = (...args: any[]) =>
    console.log(new Array(depth).join("  "), ...args)
  if ((frag as any).dbg) log(`[${(frag as any).dbg}]`)
  if (Array.isArray(frag)) frag.forEach((x) => debugPrint(x, depth + 1))
  else log(`@${count++} ${frag} (0x${(frag as any).toString(16)})`)
}

function callBuiltin(name: string): w.BytecodeFragment {
  const idx = builtinNames.indexOf(name)
  if (idx === -1) throw new Error(`builtin '${name}' not found`)
  return [w.instr.call, w.funcidx(idx)]
}

function makeWasmModule(functions: WasmFunction[], ctx: CodegenContext) {
  //   codesec(codes: w.BytecodeFragment): w.BytecodeFragment {
  //     const codeSec = checkNotNull(this.prebuilt.codeSec)
  //     const len = codeSec.len + codes.length
  //     return w.section(10, [w.u32(len), codes, Array.from(codeSec.contents)])
  //   }


  const builtinType1 = w.functype([w.valtype.f64], [w.valtype.f64])
  const builtinType2 = w.functype(
    [w.valtype.f64, w.valtype.f64],
    [w.valtype.f64],
  )

  ctx.recordFunctype(w.functype([], [w.valtype.f64])); // Must be the first recorded type

  ;[builtinType1, builtinType2].forEach((t) => ctx.recordFunctype(t))
  functions.forEach(({ type }) => ctx.recordFunctype(type))

  const imports = builtinNames.map((name) => {
    // TODO: Find a cleaner way of doing this?
    const typeIdx = ctx.recordFunctype(
      name === "pow" ? builtinType2 : builtinType1,
    )
    return frag(
      "import" + name,
      w.import_(
        "builtins",
        name,
        frag("importdesc" + name, w.importdesc.func(typeIdx)),
      ),
    )
  })
  // Go from an "user" function index (0: loss function, 1...n: gradients)
  // to the actual index in the module.
  const userFuncIdx = (idx: number) => imports.length + idx

  const exports: w.BytecodeFragment = []
  functions.forEach(({ name }, i) => {
    if (name) exports.push(w.export_(name, w.exportdesc.func(userFuncIdx(i))))
  })
  // Export the externally-defined `optimize` function.
  exports.push(w.export_("optimizex", w.exportdesc.func(userFuncIdx(functions.length))))

  const funcsec = functions.map(({ type }) =>
    w.typeidx(ctx.recordFunctype(type)),
  )

  // Append an entry for the externally-defined `optimize` function.
  funcsec.push(
    w.typeidx(
      ctx.recordFunctype(w.functype([w.valtype.i32, w.valtype.i32], [])),
    ),
  )

  const funcCount = functions.length
  const minMemSize = (funcCount - 1) * 8

  // Produce a code section combining `codeEls` with the prebuilt code.
  const codesecWithPrebuilt = (codeEls: w.BytecodeFragment) => {
    const count = prebuiltCodesec.entryCount + codeEls.length
    return w.section(10, [w.u32(count), codeEls, Array.from(prebuiltCodesec.contents)])
  }

  const bytes = w.module([
    w.typesec(ctx.functypes),
    w.importsec(imports),
    w.funcsec(funcsec),
    w.tablesec([
      w.table(
        w.tabletype(w.elemtype.funcref, w.limits.minmax(funcCount, funcCount)),
      ),
    ]),
    w.memsec([w.mem(w.limits.min(minMemSize))]),
    w.globalsec(
      ctx.globals.map((g) =>
        w.global(w.globaltype(g.type, w.mut.var), [g.initExpr, w.instr.end]),
      ),
    ),
    w.exportsec(exports),
    // Initialize the table
    w.elemsec([
      w.elem(
        0 /*w.tableidx*/,
        [w.instr.i32.const, 0, w.instr.end],
        functions.map((_, i) => w.funcidx(userFuncIdx(i))),
      ),
    ]),
    codesecWithPrebuilt(
      functions.map(({ body }) =>
        w.code(w.func([], frag("code", ...body, w.instr.end))),
      )
    ),
  ])
  //debugPrint(bytes)
  // `(mod as any[])` to avoid compiler error about excessively deep
  // type instantiation.
  return Uint8Array.from((bytes as any[]).flat(Infinity))
}

export function optimizer(
  loss: t.Num,
  gradient: Map<t.Param, t.Num>,
  params: Map<t.Param, number>,
) {
  const { instr } = w
  const ctx = new CodegenContext()

  // Get a list of [param, value] in the same order as `gradient.values()`.
  const paramEntries: [t.Param, number][] = Array.from(gradient.keys()).map(
    (p) => [p, checkNotNull(params.get(p))],
  )
  const gradientValues = Array.from(gradient.values())

  // Allocate globals for the params up front.
  paramEntries.forEach(([param, initialVal]) => {
    ctx.allocateGlobal(param, initialVal)
  })

  const functions = [loss, ...gradientValues].map((num, i) => ({
    name: "",
    type: w.functype([], [w.valtype.f64]),
    body: emitCachedNum(num, ctx),
  }))

  const importCount = builtinNames.length

  const bytes = makeWasmModule(functions, ctx)
  //  fs.writeFileSync("module.wasm", bytes)
  const mod = new WebAssembly.Module(bytes)
  const { exports } = new WebAssembly.Instance(mod, { builtins })

  function optimize(iterations: number): Map<t.Param, number> {
    if (typeof exports.optimizex !== "function")
      throw new Error(`export 'optimizex' not found or not callable`)

    // Per the WebAssembly JS API spec, the result is only an array if there's
    // more than one return value. There's no way to make it always an array.
    const result = (exports as any)["optimizex"](paramEntries.length, iterations)
    const newVals = [result].flat() // Ensure it's an array.
    return new Map(paramEntries.map(([param], i) => [param, newVals[i]]))
  }

  function emitNum(num: t.Num, ctx: CodegenContext): w.BytecodeFragment {
    switch (num.type) {
      case t.NumType.Constant:
        return frag("Constant", f64_const(num.value))
      case t.NumType.Param:
        return frag("Param", f64_const(Number.NaN))
      case t.NumType.Sum:
        return frag(
          "Sum",
          emitSum(num.firstTerm, ctx),
          f64_const(num.k),
          instr.f64.add,
        )
      case t.NumType.Product:
        return emitProduct(num.firstTerm, ctx)
      case t.NumType.Unary:
        return emitUnary(num.term, num.fn, ctx)
    }
  }

  function emitCachedNum(num: t.Num, ctx: CodegenContext): w.BytecodeFragment {
    // Constants are never cached.
    if (num.type === t.NumType.Constant) return emitNum(num, ctx)

    let result = []
    let cacheIdx = ctx.globalidx(num)
    if (cacheIdx === -1) {
      assert(num.type !== t.NumType.Param, "no global found for param")
      cacheIdx = ctx.allocateGlobal(num, 0)

      // Compute the result and write to the cache.
      result.push(emitNum(num, ctx), instr.global.set, w.u32(cacheIdx))
    }
    // Read from the cache.
    result.push(instr.global.get, w.u32(cacheIdx))
    return result
  }

  function emitSum(
    node: t.TermNode<t.SumTerm>,
    ctx: CodegenContext,
  ): w.BytecodeFragment {
    let result = frag(
      "Sum2",
      f64_const(node.a),
      emitCachedNum(node.x, ctx),
      instr.f64.mul,
    )
    if (node.nextTerm)
      return result.concat(emitSum(node.nextTerm, ctx), instr.f64.add)
    return result
  }

  function emitProduct(
    node: t.TermNode<t.ProductTerm>,
    ctx: CodegenContext,
  ): w.BytecodeFragment {
    let result = frag(
      "Pow",
      emitCachedNum(node.x, ctx),
      f64_const(node.a),
      callBuiltin("pow"),
    )
    if (node.nextTerm)
      return result.concat(emitProduct(node.nextTerm, ctx), instr.f64.mul)
    return result
  }

  function emitUnary(
    node: t.Term,
    type: t.UnaryFn,
    ctx: CodegenContext,
  ): w.BytecodeFragment {
    if (!builtinNames.includes(type)) {
      throw new Error(`not supported: ${type}`)
    }
    return frag("Unary", emitCachedNum(node, ctx), callBuiltin(type))
  }

  return { optimize }
}
