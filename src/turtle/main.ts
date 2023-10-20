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
import * as v from "./vec2"

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
const nodesById: Map<string, v.Vec2> = new Map()

let dragOrigin: { x: number; y: number } | undefined
let draggingPointerId: number | undefined
let selectedNodeIds: string[] = []

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

  if (selectedNodeIds.includes(id)) {
    ctx.lineWidth = 2
    ctx.strokeStyle = config.fgColor
    ctx.fillStyle = config.bgColor
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  } else {
    ctx.fillStyle = config.fgColor
    ctx.fillRect(r.x, r.y, r.w, r.h)
  }

  ctx.restore()
}

function render() {
  t.optimize(config.iterations, config.optimization)

  panel.render(t.computeLoss(), t.variables, k.evaluator(t.params))

  // Transient render state that is reset every frame.
  dragHandlers.clear()
  nodeRects.clear()
  nodesById.clear()

  ctx.fillStyle = config.bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 1
  ctx.strokeStyle = config.fgColor
  t.segments().forEach((s, i) => {
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2, s.y2)
    ctx.stroke()

    const nodeId1 = `${s.id}.1`
    nodesById.set(nodeId1, t.vecSegments[i].from)
    renderNode(nodeId1, s.x1, s.y1)
    dragHandlers.set(nodeId1, (x, y) => {
      t.pin(s.id, "from", x, y)
    })

    const nodeId2 = `${s.id}.2`
    nodesById.set(nodeId2, t.vecSegments[i].to)
    renderNode(nodeId2, s.x2, s.y2)
    dragHandlers.set(nodeId2, (x, y) => {
      t.pin(s.id, "to", x, y)
    })
  })

  requestAnimationFrame(render)
}

function notIncluding<T>(arr: T[], el: T): T[] {
  const idx = arr.indexOf(el)
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)]
}

function addDist(id1: string, id2: string) {
  const v0 = checkNotNull(nodesById.get(id1))
  const v1 = checkNotNull(nodesById.get(id2))

  const r1 = checkNotNull(nodeRects.get(id1))
  const r2 = checkNotNull(nodeRects.get(id2))
  const dx = r1.x - r2.x
  const dy = r1.y - r2.y
  t.dist(v0, v1, Math.sqrt(dx*dx + dy*dy) + 100)
}

function handlePointerDown(e: PointerEvent) {
  // Look in reverse render order — we want to grab the top-most.
  const rects = Array.from(nodeRects).reverse()
  const hit = rects.find(([_, r]) => rectContains(r, e.offsetX, e.offsetY))
  if (hit) {
    const id = hit[0]
    dragOrigin = { x: e.offsetX, y: e.offsetY }
    draggingPointerId = e.pointerId
    if (e.shiftKey && selectedNodeIds.includes(id)) {
      selectedNodeIds = notIncluding(selectedNodeIds, id)
    } else if (e.shiftKey) {
      selectedNodeIds.push(id)
      if (selectedNodeIds.length === 2) {
        addDist(selectedNodeIds[0], selectedNodeIds[1])
      }
    } else {
      selectedNodeIds = [id]
    }
    canvas.setPointerCapture(e.pointerId)
  } else {
    selectedNodeIds = []
  }
}

function handlePointerMove(e: PointerEvent) {
  if (e.pointerId !== draggingPointerId) return

  if (dragOrigin) {
    if (selectedNodeIds.length === 1) {
      const onDrag = checkNotNull(dragHandlers.get(selectedNodeIds[0]))
      onDrag(e.offsetX, e.offsetY)
    }
  }
}

function handlePointerUp(e: PointerEvent) {
  if (e.pointerId !== draggingPointerId) return

  dragOrigin = undefined
  draggingPointerId = undefined
  t.unpin()
}

render()
