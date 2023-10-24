import htm from "htm"
import { h, render as preactRender } from "preact"

import "./style.css"

import * as k from "../core/api"
import { defaultOptions } from "../core/wasmopt"
import { Canvas } from "./canvas"
import { checkNotNull } from "../core/assert"
import { createPanel } from "./panel"
import { Turtle } from "./turtle"
import { draw } from "./draw"

const html = htm.bind(h)

function App() {
  return html`<${Canvas} onPointerMove=${handlePointerMove} />`
}

preactRender(html`<${App} />`, checkNotNull(document.getElementById("app")))

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!

const t = new Turtle()
draw(t)

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
  t.optimize(config.iterations, config.optimization)

  panel.render(t.computeLoss(), t.variables, k.evaluator(t.params))

  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 1
  ctx.strokeStyle = config.fgColor
  t.segments().forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2, s.y2)
    ctx.stroke()
  })

  requestAnimationFrame(render)
}

function handlePointerMove(e: PointerEvent) {
  t.mouseMove(e.offsetX, e.offsetY)
}

render()
