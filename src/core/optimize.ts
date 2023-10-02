import { checkNotNull } from "./assert"
import * as e from "./eval"
import * as g from "./grad"
import { optimizer } from "./optimizer"
import * as t from "./types"

const useWasm = true

export function optimize(
  loss: t.Num,
  init: Map<t.Param, number>,
  iterations: number,
): e.Evaluator {
  const gradient = g.gradient(loss)
  const params = new Map(init)
  gradient.forEach((_, k) => {
    if (!params.has(k)) params.set(k, Math.random() * 10)
  })

  if (useWasm) {
    const { optimize } = optimizer(loss, gradient, params)
    const newParams = optimize(iterations)
    return e.evaluator(newParams)
  }

  const epsilon = 0.0001
  let i = iterations
  while (i > 0) {
    const ev = e.evaluator(params)
    const l = ev.evaluate(loss)
    if (i % 1000 == 0) {
      console.log(l)
    }
    gradient.forEach((v, k) => {
      const diff = ev.evaluate(v)
      const old = params.get(k) || 0
      const update = old - diff * epsilon
      params.set(k, update)
    })
    i = i - 1
  }

  return e.evaluator(params)
}
