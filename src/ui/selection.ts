import { Node } from "../model/node"

type SelectionMode = "single" | "multi"

export interface SelectionState {
  mode: SelectionMode
  selectedNodes: Set<Node>
}

export function selectionState(): SelectionState {
  return {
    mode: "single",
    selectedNodes: new Set(),
  }
}

export function setMode(state: SelectionState, mode: SelectionMode) {
  state.mode = mode
  state.selectedNodes = new Set()
}

export function setSelected(
  state: SelectionState,
  node: Node,
  selected = true,
) {
  if (selected) {
    if (state.mode !== "multi") {
      state.selectedNodes = new Set()
    }
    state.selectedNodes.add(node)
  } else {
    state.selectedNodes.delete(node)
  }
}

export function clearSelection(state: SelectionState) {
  state.selectedNodes = new Set()
}
