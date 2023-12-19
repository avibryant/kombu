import * as k from "../core/api"
import { checkNotNull } from "../core/assert"
import { Evaluator } from "../core/eval"
import { normal } from "../model/distribution"
import { Model, constrain } from "../model/model"
import { Node } from "../model/node"
import { distance } from "../model/point"
import { Rect, rect, rectContains } from "./rect"
import * as sel from "./selection"

type DragHandler = (x: number, y: number) => any

const dragHandlers: Map<Node, DragHandler> = new Map()
const nodeRects: Map<Node, Rect> = new Map()

let draggedNode: Node | undefined
let draggingPointerId: number | undefined

let pinPos: { x: number; y: number } | undefined

let pressedKeys = new Set<string>()
const currentChord = () => Array.from(pressedKeys).join("+")

let selState = sel.selectionState()

function hexToRgba(color: string) {
  return [
    ...[color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((s) =>
      parseInt(s, 16),
    ),
    255,
  ]
}

let nextDistId = 1

function renderDrag(
  x: number,
  y: number,
  ctx: CanvasRenderingContext2D,
  config: { fgColor: string; bgColor: string },
) {
  ctx.beginPath()
  const r = 16
  ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2)
  const rgba = hexToRgba(config.fgColor)
  rgba[3] = 0.3
  ctx.fillStyle = `rgba(${rgba.join(",")})`
  ctx.fill()
}

export function renderNode(
  model: Model,
  node: Node,
  ev: Evaluator,
  ctx: CanvasRenderingContext2D,
  config: { fgColor: string; bgColor: string },
) {
  const size = 8
  const x = ev.evaluate(node.point.x)
  const y = ev.evaluate(node.point.y)
  const r = rect(x - size / 2, y - size / 2, size, size)
  nodeRects.set(node, r)
  dragHandlers.set(node, (x: number, y: number) => {
    pinPos = { x, y }
  })

  ctx.save()
  if (selState.selectedNodes.has(node)) {
    const centerX = r.x + r.w / 2
    const centerY = r.y + r.h / 2
    renderDrag(centerX, centerY, ctx, config)
  }
  ctx.fillStyle = config.fgColor
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.strokeRect(r.x, r.y, r.w, r.h)

  if (pinPos) {
    ctx.strokeStyle = config.fgColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pinPos.x - 3, pinPos.y)
    ctx.lineTo(pinPos.x + 3, pinPos.y)
    ctx.moveTo(pinPos.x, pinPos.y - 3)
    ctx.lineTo(pinPos.x, pinPos.y + 3)
    ctx.stroke()
  }

  ctx.restore()
}

function elementFromEvent(
  e: PointerEvent,
  which: "target" | "currentTarget",
): Element {
  const target = checkNotNull(e[which])
  if (!(target instanceof Element)) {
    throw new Error("not an element:" + target)
  }
  return target as Element
}

export function handlePointerDown(model: Model, e: PointerEvent) {
  nodeRects.forEach((r, node) => {
    if (rectContains(r, e.offsetX, e.offsetY)) {
      draggedNode = node
      sel.setSelected(selState, node)
      draggingPointerId = e.pointerId
      elementFromEvent(e, "target").setPointerCapture(e.pointerId)
    }
  })

  if (currentChord() === "c" && selState.selectedNodes.size === 2) {
    const [a, b] = Array.from(selState.selectedNodes)
    sel.clearSelection(selState)

    const d = distance(a.point, b.point)
    const param = k.observation(`dist${nextDistId++}`)
    constrain(model, "dist", normal(param, 20), d)
    model.observations.set(param, model.ev.evaluate(d))
  }
}

export function handlePointerMove(e: PointerEvent) {
  if (e.pointerId !== draggingPointerId) return

  if (draggedNode) {
    const onDrag = checkNotNull(dragHandlers.get(draggedNode))
    onDrag(e.offsetX, e.offsetY)
  }
}

export function handlePointerUp(e: PointerEvent) {
  if (e.pointerId !== draggingPointerId) return

  draggedNode = undefined
  draggingPointerId = undefined
  pinPos = undefined
}

function updateSelectionMode() {
  const mode = currentChord() === "c" ? "multi" : "single"
  sel.setMode(selState, mode)
}

export function handleKeyDown(model: Model, e: KeyboardEvent) {
  const param: k.Param = Array.from(model.observations.keys())[0]
  if (param) {
    const currVal = checkNotNull(model.observations.get(param))
    console.log({ currVal })
    switch (e.key) {
      case "w":
        model.observations.set(param, currVal + 1)
        break
      case "s":
        model.observations.set(param, currVal - 1)
        break
    }
  }

  if (e.repeat) return // Ignore repeats
  pressedKeys.add(e.key)
  updateSelectionMode()
}

export function handleKeyUp(e: KeyboardEvent) {
  pressedKeys.delete(e.key)
  updateSelectionMode()
}
