import htm from "htm"
import { h, render as preactRender } from "preact"
import { useEffect } from "preact/hooks"
import { useSignal } from "@preact/signals"

import "./style.css"

import { checkNotNull } from "../core/assert"
import { Rect, contains } from "./rect"
import { Turtle } from "./turtle"

const html = htm.bind(h)

function Canvas(props: {
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
}) {
  const width = useSignal(window.innerWidth)
  const height = useSignal(window.innerHeight)

  const onResize = () => {
    width.value = window.innerWidth
    height.value = window.innerHeight
  }

  useEffect(() => {
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return html`
    <div>
      <canvas
        id="canvas"
        width=${width}
        height=${height}
        onPointerDown=${props.onPointerDown}
        onPointerMove=${props.onPointerMove}
        onPointerUp=${props.onPointerUp}
      >
      </canvas>
    </div>
  `
}

function App() {
  return html` <${Canvas}
    onPointerDown=${handlePointerDown}
    onPointerMove=${handlePointerMove}
    onPointerUp=${handlePointerUp}
  />`
}

preactRender(html`<${App} />`, checkNotNull(document.getElementById("app")))

const bgColor = "black"
const fgColor = "white"

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!

const t = new Turtle()
const o = t.position
t.forward(t.approxLength(100))
t.right(t.anyAngle())
t.forward(t.approxLength(200))
t.right(t.anyAngle())
t.forward(t.approxLength(300))
t.at(o)

const ctx = canvas.getContext("2d")!

interface NodeState {
  dragging: boolean
  rect: Rect
}

type DragHandler = (x: number, y: number) => any

let nodeState: Map<string, NodeState> = new Map()
let prevState: Map<string, NodeState> = new Map()

let dragHandlers: Map<string, DragHandler> = new Map()

function mergeState(id: string, update: Partial<NodeState>) {
  const old = prevState.get(id) ?? {
    dragging: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
  }
  const state = {
    ...old,
    ...update,
  }
  nodeState.set(id, state)
  return state
}

function renderNode(id: string, x: number, y: number) {
  const size = 8
  const rect = {
    x: x - size / 2,
    y: y - size / 2,
    w: size,
    h: size,
  }
  const state = mergeState(id, { rect })

  ctx.save()
  ctx.fillStyle = state.dragging ? "#7DEF4A" : fgColor
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

function render(i = 1) {
  // Transient state
  dragHandlers = new Map()

  // State that is persisted across frames
  prevState = nodeState
  nodeState = new Map()

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 1
  ctx.strokeStyle = fgColor
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
  t.optimize(1000)

  //  if (i > 0) {
  requestAnimationFrame(() => render(i - 1))
  //  }
}

interface PointerState {
  draggedId: string
}

const pointerState = new Map<number, PointerState>()

function handlePointerMove(e: PointerEvent) {
  pointerState.forEach(({ draggedId }) => {
    const { dragging } = checkNotNull(nodeState.get(draggedId))
    if (dragging) {
      const onDrag = checkNotNull(dragHandlers.get(draggedId))
      onDrag(e.offsetX, e.offsetY)
    }
  })
}

function handlePointerDown(e: PointerEvent) {
  nodeState.forEach((state, id) => {
    if (contains(state.rect, e.offsetX, e.offsetY)) {
      mergeState(id, { dragging: true })
      canvas.setPointerCapture(e.pointerId)
      pointerState.set(e.pointerId, { draggedId: id })
    }
  })
}

function handlePointerUp(e: PointerEvent) {
  if (!pointerState.has(e.pointerId)) return
  const { draggedId } = pointerState.get(e.pointerId)!
  mergeState(draggedId, { dragging: false })
  pointerState.delete(e.pointerId)
  t.unpin()
}

render()
