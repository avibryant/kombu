import { bench, run } from "mitata"

import {
  Model,
  emptyModel,
  someLength,
  someAngle,
  totalLoss,
} from "../src/model/model"
import { forward, right, at, turtle, Turtle } from "../src/turtle/turtle"
import * as k from "../src/core/api"

function square(t: Turtle, id: number) {
  const side = someLength(t.model, `A${id}`)
  const a = someAngle(t.model, `a${id}`)

  const o = t.position
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)

  at(t, o)
}

function draw(m: Model) {
  const t = turtle(m)

  for (let i = 0; i < 4; i++) {
    square(t, i)
  }
}

let model: Model = emptyModel()
draw(model)

let lossValue = totalLoss(model)

let loss: k.Loss
bench("k.loss()", () => {
  loss = k.loss(lossValue)
})

let optimizer: k.Optimizer
bench("creating optimizer", () => {
  optimizer = k.optimizer(loss, model.ev.params)
})

bench("optimize", () => {
  optimizer.optimize(20, new Map())
})

await run({
  avg: true, // enable/disable avg column (default: true)
  json: false, // enable/disable json output (default: false)
  colors: true, // enable/disable colors (default: true)
  min_max: true, // enable/disable min/max column (default: true)
  collect: false, // enable/disable collecting returned values into an array during the benchmark (default: false)
  percentiles: false, // enable/disable percentiles column (default: true)
})
