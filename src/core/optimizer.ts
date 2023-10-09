import * as w from "@wasmgroundup/emit"

import { assert, checkNotNull } from "./assert"
import * as t from "./types"

const SIZEOF_F64 = 8

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

function f64_const(v: number) {
  return frag("f64_const", w.instr.f64.const, w.f64(v))
}

// Required as an immediate arg for all loads/stores.
const alignmentAndOffset = w.memarg(3 /* bits */, 0)

function f64_load(offset: number) {
  return [
    [w.instr.i32.const, w.i32(offset)],
    [w.instr.f64.load, alignmentAndOffset],
  ]
}

function f64_store(offset: number, frag: w.BytecodeFragment) {
  return [
    [w.instr.i32.const, w.i32(offset)],
    frag,
    [w.instr.f64.store, alignmentAndOffset],
  ]
}

class CodegenContext {
  cacheEntries: { initExpr: w.BytecodeFragment | undefined }[] = []
  cacheOffsetById = new Map<number, number>()
  functypeToIdx = new Map<string, number>()
  functypes: w.BytecodeFragment = []

  allocateCache(num: IdentifiableNum, initialVal: number): number {
    const offset = this.cacheEntries.length * SIZEOF_F64
    this.cacheOffsetById.set(num.id, offset)
    this.cacheEntries.push({ initExpr: f64_const(initialVal) })
    return offset
  }

  cacheOffset(num: IdentifiableNum): number | undefined {
    return this.cacheOffsetById.get(num.id)
  }

  cacheOffsetForParam(p: t.Param) {
    return checkNotNull(this.cacheOffset(p))
  }

  typeidxForFunctype(type: w.BytecodeFragment): w.BytecodeFragment {
    const idx = checkNotNull(this.functypeToIdx.get(JSON.stringify(type)))
    return w.typeidx(idx)
  }

  recordFunctype(type: w.BytecodeFragment): number {
    const k = JSON.stringify(type)
    if (this.functypeToIdx.has(k)) {
      return this.functypeToIdx.get(k)!
    }
    const idx = this.functypeToIdx.size
    this.functypeToIdx.set(k, idx)
    this.functypes.push(type)
    return idx
  }

  memorySize() {
    return this.cacheEntries.length * SIZEOF_F64
  }
}

interface WasmFunction {
  name: string
  type: w.BytecodeFragment
  body: w.BytecodeFragment
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
  const builtinType1 = w.functype([w.valtype.f64], [w.valtype.f64])
  const builtinType2 = w.functype(
    [w.valtype.f64, w.valtype.f64],
    [w.valtype.f64],
  )

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
        frag("importdesc" + name, w.importdesc.func(w.typeidx(typeIdx))),
      ),
    )
  })

  const exports: w.BytecodeFragment = []
  functions.forEach(({ name }, i) => {
    if (name)
      exports.push(w.export_(name, w.exportdesc.func(imports.length + i)))
  })

  imports.push(
    w.import_(
      "memory",
      "cache",
      w.importdesc.mem(w.memtype(w.limits.min(ctx.memorySize()))),
    ),
  )

  const bytes = w.module([
    w.typesec(ctx.functypes),
    w.importsec(imports),
    w.funcsec(functions.map(({ type }) => w.typeidx(ctx.recordFunctype(type)))),
    w.exportsec(exports),
    w.codesec(
      functions.map(({ body }) =>
        w.code(w.func([], frag("code", ...body, w.instr.end))),
      ),
    ),
  ])
  //  debugPrint(bytes)
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

  // Allocate storage for the params up front.
  paramEntries.forEach(([param, initialVal]) => {
    ctx.allocateCache(param, initialVal)
  })

  const functions = [loss, ...gradientValues].map((num) => ({
    name: "",
    type: w.functype([], [w.valtype.f64]),
    body: emitCachedNum(num, ctx),
  }))

  const importCount = builtinNames.length
  const epsilon = 0.0001

  // optimize(iterations: i32): f64[]
  functions.push({
    name: "optimize",
    type: w.functype(
      [w.valtype.i32],
      paramEntries.map((_) => w.valtype.f64),
    ),
    body: [
      [instr.block, w.blocktype()],

      // while (i > 0)
      [instr.loop, w.blocktype()],
      [instr.local.get, 0, instr.i32.eqz, instr.br_if, 1],

      // compute the loss function
      [instr.call, w.funcidx(importCount), instr.drop],

      // Evaluate all of the gradients
      gradientValues.map((_, i) => {
        const [param] = paramEntries[i]
        const cacheOffset = ctx.cacheOffsetForParam(param)
        return [
          // params.set(k, update)
          f64_store(
            cacheOffset,
            frag(
              "f64_storeval",
              // const diff = ev.evaluate(v)
              [instr.call, w.funcidx(importCount + i + 1)],

              // const update = old - diff * epsilon
              f64_const(-epsilon),
              instr.f64.mul,
              f64_load(cacheOffset),
              instr.f64.add,
            ),
          ),
        ]
      }),
      // i = i - 1
      [
        [instr.local.get, 0],
        [instr.i32.const, 1],
        instr.i32.sub,
        [instr.local.set, 0],
      ],
      [instr.br, 0, instr.end], // end loop
      instr.end, // end block
      paramEntries.map(([p, _]) => {
        const offset = checkNotNull(ctx.cacheOffset(p))
        return f64_load(offset)
      }),
    ],
  })
  // Allocate and initialize the memory for the cache.
  const cache = new WebAssembly.Memory({ initial: ctx.memorySize() })
  const cacheView = new Float64Array(cache.buffer)
  paramEntries.forEach(([_, val], i) => {
    cacheView[i] = val
  })

  const bytes = makeWasmModule(functions, ctx)
  const mod = new WebAssembly.Module(bytes)
  const { exports } = new WebAssembly.Instance(mod, {
    builtins,
    memory: { cache },
  })

  function optimize(iterations: number): Map<t.Param, number> {
    if (typeof exports.optimize !== "function")
      throw new Error(`export 'optimize' not found or not callable`)
    ;(exports as any)["optimize"](iterations)

    return new Map(
      paramEntries.map(([param], i) => {
        return [param, cacheView[i]]
      }),
    )
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
    let cacheOffset = ctx.cacheOffset(num)
    if (cacheOffset === undefined) {
      assert(num.type !== t.NumType.Param, "no cache found for param")
      cacheOffset = ctx.allocateCache(num, 0)

      // Compute the result and write to the cache.
      result.push(f64_store(cacheOffset, emitNum(num, ctx)))
    }
    // Read from the cache.
    result.push(f64_load(cacheOffset))
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
