import { Rect, rect, rectContains } from "./rect"
import { checkNotNull } from "../core/assert"
import { Evaluator } from "../core/eval"
import { Node } from "../model/node"

type DragHandler = (x: number, y: number) => any

const dragHandlers: Map<Node, DragHandler> = new Map()
const nodeRects: Map<Node, Rect> = new Map()

let draggedNode: Node | undefined
let draggingPointerId: number | undefined

let pinPos: { x: number; y: number } | undefined

export function renderNode(
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
  ctx.fillStyle = draggedNode === node ? "#7DEF4A" : config.fgColor
  ctx.fillRect(r.x, r.y, r.w, r.h)

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

export function handlePointerDown(e: PointerEvent) {
  nodeRects.forEach((r, node) => {
    if (rectContains(r, e.offsetX, e.offsetY)) {
      draggedNode = node
      draggingPointerId = e.pointerId
      elementFromEvent(e, "target").setPointerCapture(e.pointerId)
    }
  })
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
