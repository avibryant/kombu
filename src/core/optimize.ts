import * as t from "./types"
import * as e from "./eval"
import * as g from "./grad"

//import { evaluator as wasmEvaluator } from "./evalwasm"

//const useWasm = false

export function optimize(
  loss: t.Num,
  state: e.ComputeState,
): { evaluator: e.Evaluator; begin: () => Generator<number> } {
  const gradient = g.gradient(loss)
  gradient.forEach((_, k) => {
    // TODO implement a setParamDefaults() method on ComputeState?
    if (!state.hasParam(k)) state.setParam(k, Math.random() * 10)
  })
  const ev = e.evaluator(state)

  function* stepGen() {
    const epsilon = 0.0001
    let i = 0
    while (true) {
      const l = ev.evaluate(loss)
      if (++i % 1000 == 0) {
        console.log(l)
      }
      gradient.forEach((v, k) => {
        const diff = ev.evaluate(v)
        const old = state.getParam(k) ?? 0
        const update = old - diff * epsilon
        state.setParam(k, update)
      })
      yield l
    }
  }

  //  return (useWasm ? wasmEvaluator : e.evaluator)(params)
  return {
    evaluator: ev,
    begin: () => stepGen(),
  }
}
