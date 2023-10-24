import htm from "htm"
import { h, render as preactRender } from "preact"

import "./style.css"

import * as k from "../core/api"
import { defaultOptions } from "../core/wasmopt"
import { Canvas } from "./canvas"
import { checkNotNull } from "../core/assert"
import { createPanel } from "./panel"
import { Rect, rectContains, rect } from "./rect"
import { Turtle } from "./turtle"
import {draw} from './draw'

const html = htm.bind(h)

function App() {
  return html`<${Canvas}
    onPointerDown=${handlePointerDown}
    onPointerMove=${handlePointerMove}
    onPointerUp=${handlePointerUp}
  />`
}

preactRender(html`<${App} />`, checkNotNull(document.getElementById("app")))

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!

const t = new Turtle()
draw(t)


const ctx = canvas.getContext("2d")!

type DragHandler = (x: number, y: number) => any

const dragHandlers: Map<string, DragHandler> = new Map()
const nodeRects: Map<string, Rect> = new Map()

let draggedNodeId = ""
let draggingPointerId: number | undefined

const config = {
  bgColor: "#000",
  fgColor: "#fff",
  optimization: {
    ...defaultOptions,
  },
  iterations: 10000,
}

const panel = createPanel(config)

function renderNode(id: string, x: number, y: number) {
  const size = 8
  const r = rect(x - size / 2, y - size / 2, size, size)
  nodeRects.set(id, r)

  ctx.save()
  ctx.fillStyle = draggedNodeId === id ? "#7DEF4A" : config.fgColor
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.restore()
}

function render() {
  t.optimize(config.iterations, config.optimization)

  panel.render(t.computeLoss(), t.variables, k.evaluator(t.params))

  // Transient render state that is reset every frame.
  // This shouldn't be reactive.
  dragHandlers.clear()
  nodeRects.clear()

  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 1
  ctx.strokeStyle = config.fgColor
  t.segments().forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2, s.y2)
    ctx.stroke()

    const nodeId1 = `${s.id}.1`
    renderNode(nodeId1, s.x1, s.y1)
    dragHandlers.set(nodeId1, (x, y) => {
      t.pin(s.id, "from", x, y)
    })

    const nodeId2 = `${s.id}.2`
    renderNode(nodeId2, s.x2, s.y2)
    dragHandlers.set(nodeId2, (x, y) => {
      t.pin(s.id, "to", x, y)
    })
  })

  requestAnimationFrame(render)
}

function handlePointerMove(e: PointerEvent) {
  if (e.pointerId !== draggingPointerId) return

  if (draggedNodeId) {
    const onDrag = checkNotNull(dragHandlers.get(draggedNodeId))
    onDrag(e.offsetX, e.offsetY)
  }
}

function handlePointerDown(e: PointerEvent) {
  nodeRects.forEach((r, id) => {
    if (rectContains(r, e.offsetX, e.offsetY)) {
      draggedNodeId = id
      draggingPointerId = e.pointerId
      canvas.setPointerCapture(e.pointerId)
    }
  })
}

function handlePointerUp(e: PointerEvent) {
  if (e.pointerId !== draggingPointerId) return

  draggedNodeId = ""
  draggingPointerId = undefined
  t.unpin()
}

render()
