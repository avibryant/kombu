import { signal } from "@preact/signals"
import htm from "htm"
import { h, render as preactRender } from "preact"
import { Pane } from "tweakpane"

import "./style.css"

import { Canvas } from "./canvas"
import * as k from "../core/api"
import { checkNotNull } from "../core/assert"
import { Panel } from "./panel"
import { Rect, rectContains, rect } from "./rect"
import { Turtle } from "./turtle"

const html = htm.bind(h)

const turtleParams = signal(new Map<k.Param, number>())

function App() {
  return html`<${Canvas}
      onPointerDown=${handlePointerDown}
      onPointerMove=${handlePointerMove}
      onPointerUp=${handlePointerUp}
    />
    <${Panel} params=${turtleParams.value} /> `
}

preactRender(html`<${App} />`, checkNotNull(document.getElementById("app")))

const config = {
  bgColor: "#000",
  fgColor: "#fff",
}

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!

const t = new Turtle()
const o = t.position

t.forward(t.approxLength("A", 100))
t.right(t.anyAngle("q"))
t.forward(t.approxLength("B", 200))
t.right(t.anyAngle("r"))
t.forward(t.approxLength("C", 300))
t.at(o)

const ctx = canvas.getContext("2d")!

type DragHandler = (x: number, y: number) => any

const dragHandlers: Map<string, DragHandler> = new Map()
const nodeRects: Map<string, Rect> = new Map()

let draggedNodeId = ""
let draggingPointerId: number | undefined

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
  t.optimize(10000)
//  renderTweakspane()
  turtleParams.value = new Map([
    ...t.params.entries()
  ])

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

let pane: Pane

function renderTweakspane() {
  if (pane) pane.dispose()
  pane = new Pane()

  t.params.forEach((value, p) => {
    const obj = { value }
    const f = pane.addFolder({
      title: p.name,
    })
    f.addBinding(obj, "value")
    pane.addBinding(obj, "value", {
      readonly: true,
      view: "graph",
      interval: 16,
    })
  })

  const colors = pane.addFolder({
    title: "Colors",
  })
  colors.addBinding(config, "bgColor", { label: "bg" })
  colors.addBinding(config, "fgColor", { label: "stroke" })
  //  colors.hidden = true
}

render()
