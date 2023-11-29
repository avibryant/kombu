import { baseline, bench, group, run } from "mitata"
import * as fs from "node:fs"
import { Session } from "node:inspector/promises"

import * as k from "../src/core/api"
import {
  Model,
  emptyModel,
  someAngle,
  someLength,
  totalLoss,
} from "../src/model/model"
import { Turtle, at, forward, right, turtle } from "../src/turtle/turtle"

let inspector: Session
if (process.argv[2] === "--prof") {
  inspector = new Session()
  inspector.connect()
}

let profileName: string = ""
let profiles: string[] = []

async function maybeStartProfiling(name: string) {
  if (inspector && !profileName) {
    await inspector.post("Profiler.enable")
    await inspector.post("Profiler.start")
    profileName = name
  }
}

async function maybeStopProfiling() {
  if (profileName) {
    const { profile } = await inspector.post("Profiler.stop")
    const basename = profileName.replace(/[^a-zA-Z0-9]/g, "-")
    fs.writeFileSync(`${basename}.cpuprofile`, JSON.stringify(profile))
    profiles.push(`${basename}.cpuprofile`)
    profileName = ""
  }
}

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

  for (let i = 0; i < 40; i++) {
    square(t, i)
  }
}

function addBench<T>(
  shortName: string,
  fullName: string,
  fn: () => T | Promise<T>,
) {
  bench(shortName, async () => {
    await maybeStartProfiling(fullName)
    await fn()
  })
  // Hack: mitata doesn't offer any way to do teardown after a bench.
  if (inspector) bench("[save profile]", maybeStopProfiling)
}

;(async function main() {
  let model: Model = emptyModel()
  draw(model)

  let lossValue = totalLoss(model)

  let loss: k.Loss

  addBench("k.loss()", "k.loss", async () => {
    loss = k.loss(lossValue)
  })

  let optimizer: k.Optimizer

  function optimize() {
    optimizer.optimize(20, new Map())
  }

  group("creating optimizer", () => {
    addBench("Wasm", "creating-optimizer-wasm", () => {
      optimizer = k.optimizer(loss, model.ev.params)
    })
    addBench("JS", "creating-optimizer-js", () => {
      optimizer = k.optimizer(loss, model.ev.params, false)
    })
  })
  group("optimizing", () => {
    addBench("Wasm", "optizing-wasm", optimize)
    addBench("JS", "optimizing-js", optimize)
  })

  await run({
    percentiles: false,
  })

  profiles.forEach((name) => {
    console.log(`Wrote ${name}`)
  })
})()
