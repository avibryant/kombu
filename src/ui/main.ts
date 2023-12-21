import htm from "htm"
import { h, render as preactRender } from "preact"

import "./style.css"

import { Canvas } from "./canvas"
import { createPanel } from "./panel"
import * as r from "./render"
import { checkNotNull } from "../core/assert"
import { drawSquare } from "../turtle/draw"
import { optimize, totalLoss } from "../model/model"
import { renderView } from "../model/view"
import { tex } from "../core/api"
import { createStore, updateModel } from "./store"

const store = createStore()

const html = htm.bind(h)

function App() {
  return html`<${Canvas}
    onPointerDown=${(e: PointerEvent) => r.handlePointerDown(store, e)}
    onPointerMove=${(e: PointerEvent) => r.handlePointerMove(store, e)}
    onPointerUp=${(e: PointerEvent) => r.handlePointerUp(store, e)}
  />`
}

preactRender(html`<${App} />`, checkNotNull(document.getElementById("app")))

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!

updateModel(store, (m) => {
  drawSquare(m)
  console.log(tex(totalLoss(m)))
})

// For now, the tweakpane is the only thing that can change the config.
// If/when that changes, we'll need a better way of syncing changes.
const mutableConfig = cloneDeep(store.getState().config)
const panel = createPanel(mutableConfig, () => {
  store.setState({ config: mutableConfig })
})

function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

const ctx = canvas.getContext("2d")!

function render() {
  const state = store.getState()
  const { config } = state
  const opts = config.optimizeOptions[config.method]

  store.setState({
    model: optimize(state.model, config.maxIterations, opts),
  })
  const { model } = store.getState()

  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  model.views.forEach((v) => {
    renderView(v, model.ev, ctx, config.fgColor)
  })
  model.nodes.forEach((n) => {
    r.renderNode(store.getState(), ctx, n)
  })
  panel.render(model)

  requestAnimationFrame(render)
}

render()
