import { checkNotNull } from "../core/assert"
import { Node } from "../model/node"
import { Rect, rect, rectContains } from "./rect"
import { AppState, Store } from "./store"

type DragHandler = (store: Store<AppState>, x: number, y: number) => any

const dragHandlers: Map<Node, DragHandler> = new Map()
const nodeRects: Map<Node, Rect> = new Map()

export function renderNode(
  state: AppState,
  ctx: CanvasRenderingContext2D,
  node: Node,
) {
  const { config, model, draggedNode, pinPos } = state
  const size = 8
  const x = model.ev.evaluate(node.point.x)
  const y = model.ev.evaluate(node.point.y)
  const r = rect(x - size / 2, y - size / 2, size, size)
  nodeRects.set(node, r)
  dragHandlers.set(node, (store: Store<AppState>, x: number, y: number) => {
    store.setState({
      pinPos: { x, y },
    })
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

export function handlePointerDown(store: Store<AppState>, e: PointerEvent) {
  nodeRects.forEach((r, node) => {
    if (rectContains(r, e.offsetX, e.offsetY)) {
      store.setState({
        draggedNode: node,
        draggingPointerId: e.pointerId,
      })
      elementFromEvent(e, "target").setPointerCapture(e.pointerId)
    }
  })
}

export function handlePointerMove(store: Store<AppState>, e: PointerEvent) {
  const { draggedNode, draggingPointerId } = store.getState()
  if (e.pointerId !== draggingPointerId) return

  if (draggedNode) {
    const onDrag = checkNotNull(dragHandlers.get(draggedNode))
    onDrag(store, e.offsetX, e.offsetY)
  }
}

export function handlePointerUp(store: Store<AppState>, e: PointerEvent) {
  const { draggingPointerId } = store.getState()
  if (e.pointerId !== draggingPointerId) return

  store.setState({
    draggedNode: undefined,
    draggingPointerId: undefined,
    pinPos: undefined,
  })
}
