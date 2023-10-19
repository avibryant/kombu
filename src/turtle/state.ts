import { signal, Signal } from "@preact/signals"

import { Rect } from "./rect"

interface PointerState {
  draggedId: string
}

interface NodeState {
  dragging: boolean
  rect: Rect
}

interface AppState {
  pointers: Signal<Map<number, PointerState>>
  nodes: Signal<Map<string, NodeState>>
  prevNodes: Map<string, NodeState>

  step(): void
}

export function createAppState(): AppState {
  const pointers = signal(new Map())
  let nodes = signal(new Map())
  let prevNodes = new Map()
  let stepCount = signal(0)

  return {
    pointers,
    nodes,
    prevNodes,
    step() {
      stepCount.value += 1
      prevNodes = nodes.value
      nodes.value = new Map()
    },
  }
}

export function mergeNodeState(
  state: AppState,
  id: string,
  update: Partial<NodeState>,
) {
  const old = state.prevNodes.get(id) ?? {
    dragging: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
  }
  const newVal = {
    ...old,
    ...update,
  }
  state.nodes.value = new Map([...state.nodes.value.entries(), [id, newVal]])
  return newVal
}

export function setPointerState(
  state: AppState,
  id: number,
  val: PointerState,
) {
  state.pointers.value = new Map([...state.pointers.value.entries(), [id, val]])
}
