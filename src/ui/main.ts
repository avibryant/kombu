import htm from "htm"
import { h, render as preactRender } from "preact"

import "./style.css"

import { tex } from "../core/api"
import { checkNotNull } from "../core/assert"
import { defaultOptions, makeDefaults } from "../core/options"
import { Model, emptyModel, optimize, totalLoss } from "../model/model"
import { renderView } from "../model/view"
import { drawSquare } from "../turtle/draw"
import { Canvas } from "./canvas"
import { createPanel } from "./panel"
import * as r from "./render"

const html = htm.bind(h)

function App() {
  return html`<${Canvas}
    onPointerDown=${r.handlePointerDown}
    onPointerMove=${r.handlePointerMove}
    onPointerUp=${r.handlePointerUp}
  />`
}

preactRender(html`<${App} />`, checkNotNull(document.getElementById("app")))

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!

let model: Model = emptyModel()
drawSquare(model)
console.log(tex(totalLoss(model)))

const ctx = canvas.getContext("2d")!

const config = {
  bgColor: "#000",
  fgColor: "#fff",
  method: defaultOptions.method,
  optimizeOptions: makeDefaults(),
  maxIterations: 30,
}

const panel = createPanel(config)

function render() {
  const opts = config.optimizeOptions[config.method]
  model = optimize(model, config.maxIterations, opts)

  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  model.views.forEach((v) => {
    renderView(v, model.ev, ctx, config.fgColor)
  })
  model.nodes.forEach((n) => {
    r.renderNode(n, model.ev, ctx, config)
  })
  panel.render(totalLoss(model), [], model.ev)

  requestAnimationFrame(render)
}

render()
