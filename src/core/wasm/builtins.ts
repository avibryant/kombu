import * as w from "@wasmgroundup/emit"
import { checkNotNull } from "../assert"

export interface BuiltinFunction {
  name: string
  type: w.BytecodeFragment
  impl: WebAssembly.ImportValue
}

export const builtins = ["log", "exp", "sign", "abs", "cos", "sin", "atan"].map(
  (name) => ({
    name,
    type: w.functype([w.valtype.f64], [w.valtype.f64]),
    impl: checkNotNull((Math as any)[name]),
  }),
)
builtins.push({
  name: "pow",
  type: w.functype([w.valtype.f64, w.valtype.f64], [w.valtype.f64]),
  impl: Math.pow,
})
