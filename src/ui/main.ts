import htm from "htm"
import { h, render as preactRender } from "preact"

import "./style.css"

import { defaultOptions } from "../core/wasmopt"
import { Canvas } from "./canvas"
import { checkNotNull } from "../core/assert"
import { createPanel } from "./panel"
import { draw } from "../turtle/draw"
import {Model, emptyModel, optimize} from '../model/model'
import {renderView} from '../model/view'

const html = htm.bind(h)

function App() {
  return html`<${Canvas} onPointerMove=${handlePointerMove} />`
}

preactRender(html`<${App} />`, checkNotNull(document.getElementById("app")))

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!

let model: Model = emptyModel()
draw(model)

const ctx = canvas.getContext("2d")!

const config = {
  bgColor: "#000",
  fgColor: "#fff",
  optimization: {
    ...defaultOptions,
  },
  iterations: 10000,
}

const panel = createPanel(config)

function render() {
  model = optimize(model, config.iterations, config.optimization)

  //panel.render(model)

  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  model.views.forEach((v) => {
    renderView(v, ctx, config.fgColor)
  })

  requestAnimationFrame(render)
}

function handlePointerMove(e: PointerEvent) {
}

render()
