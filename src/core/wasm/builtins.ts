import { functype, valtype } from "@wasmgroundup/emit"
import { checkNotNull } from "../assert"

export const builtins = ["log", "exp", "sign", "abs", "cos", "sin", "atan"].map(
  (name) => ({
    name,
    type: functype([valtype.f64], [valtype.f64]),
    impl: checkNotNull((Math as any)[name]),
  }),
)
builtins.push({
  name: "pow",
  type: functype([valtype.f64, valtype.f64], [valtype.f64]),
  impl: Math.pow,
})
