import htm from "htm"
import { h, render as preactRender } from "preact"

import "./style.css"

import { Canvas } from "./canvas"
import * as r from "./render"
import { checkNotNull } from "../core/assert"
import { defaultOptions } from "../core/wasmopt"
import { draw } from "../turtle/draw"
import { Model, emptyModel, optimize, totalLoss } from "../model/model"
import { renderView } from "../model/view"
import { tex } from "../core/api"

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
draw(model)
console.log(tex(totalLoss(model)))

const ctx = canvas.getContext("2d")!

const config = {
  bgColor: "#000",
  fgColor: "#fff",
  optimization: {
    ...defaultOptions,
  },
  iterations: 10000,
}

function render() {
  model = optimize(model, config.iterations, config.optimization)

  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  model.views.forEach((v) => {
    renderView(v, model.ev, ctx, config.fgColor)
  })
  model.nodes.forEach((n) => {
    r.renderNode(n, model.ev, ctx, config)
  })

  requestAnimationFrame(render)
}

render()
