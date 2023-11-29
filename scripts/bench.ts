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
import { drawSierpinski } from "../src/turtle/draw"
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

function drawSquares(m: Model) {
  const t = turtle(m)

  for (let i = 0; i < 4; i++) {
    square(t, i)
  }
}

function addBench<T>(example: string, stage: string, fn: () => T | Promise<T>) {
  bench(`[${example}] ${stage}`, async () => {
    const cleanName = stage
      .split(/[^a-zA-Z]+/)
      .filter((x) => !!x)
      .join("-")
    const profName = `${example}-${cleanName}`
    await maybeStartProfiling(profName)
    await fn()
  })
  // Hack: mitata doesn't offer any way to do teardown after a bench.
  if (inspector) bench("…", maybeStopProfiling)
}

function example(drawFn: (m: Model) => void) {
  let model: Model = emptyModel()
  drawFn(model)
  return {
    model,
    totalLoss: totalLoss(model),
  }
}

;(async function main() {
  let loss: k.Loss
  let optimizer: k.Optimizer

  const examples = {
    squares: example(drawSquares),
    sierp: example(drawSierpinski),
  }

  function optimize() {
    optimizer.optimize(20, new Map())
  }

  ;["squares", "sierp"].forEach((name) => {
    const { model, totalLoss } = examples[name]
    addBench(name, "k.loss()", async () => {
      loss = k.loss(totalLoss)
    })
    addBench(name, "creating Wasm optimizer", () => {
      optimizer = k.optimizer(loss, model.ev.params)
    })
    addBench(name, "creating JS optimizer", () => {
      optimizer = k.optimizer(loss, model.ev.params, false)
    })
    addBench(name, "optimize (Wasm)", optimize)
    addBench(name, "optimize (JS)", optimize)
  })

  await run({
    percentiles: false,
  })

  profiles.forEach((name) => {
    console.log(`Wrote ${name}`)
  })
})()
