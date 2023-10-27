import { Rect, rect } from "./rect"
import { Evaluator } from "../core/eval"
import { Node } from "../model/node"

type DragHandler = (x: number, y: number) => any

const dragHandlers: Map<string, DragHandler> = new Map()
const nodeRects: Map<Node, Rect> = new Map()

let draggedNode: Node | undefined

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
  dragHandlers

  ctx.save()
  ctx.fillStyle = draggedNode === node ? "#7DEF4A" : config.fgColor
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.restore()
}
