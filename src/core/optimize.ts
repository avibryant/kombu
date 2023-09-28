import * as t from "./types"
import * as e from "./eval"
import * as g from "./grad"

import { evaluator as wasmEvaluator } from "./evalwasm"

const useWasm = false

export function optimize(
  loss: t.Num,
  init: Map<t.Param, number>,
): { evaluator: e.Evaluator; begin: () => Generator<number> } {
  const gradient = g.gradient(loss)
  const params = new Map(init)
  gradient.forEach((_, k) => {
    if (!params.has(k)) params.set(k, Math.random() * 10)
  })
  const roots = [loss, ...gradient.values()]
  // TODO: This should be allocated via the evaluator
  const ev = (useWasm ? e.evaluator : wasmEvaluator)(roots, params)

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
        const old = ev.state.getParam(k) ?? 0
        const update = old - diff * epsilon
        ev.state.setParam(k, update)
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
