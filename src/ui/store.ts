import * as immer from "immer"

import {
  defaultOptions,
  GradientDescentOptions,
  LBFGSOptions,
  makeDefaults,
  OptimizeOptions,
} from "../core/options"
import { emptyModel, Model } from "../model/model"
import { Node } from "../model/node"

immer.enableMapSet() // https://immerjs.github.io/immer/map-set

export interface Config {
  bgColor: string
  fgColor: string
  method: OptimizeOptions["method"]
  optimizeOptions: {
    LBFGS: LBFGSOptions
    GradientDescent: GradientDescentOptions
  }
  maxIterations: number
}

export interface AppState {
  model: Model
  config: Config
  draggedNode: Node | undefined
  draggingPointerId: number | undefined
  pinPos: { x: number; y: number } | undefined
  selectedNodes: Node[]
  selectionMode: "single" | "multi"
}

export interface Store<T> {
  getState: () => T
  setState: (s: Partial<T>) => void
}

export function createStore(): Store<AppState> {
  let state: AppState = {
    model: emptyModel(),
    config: {
      bgColor: "#000",
      fgColor: "#fff",
      method: defaultOptions.method,
      optimizeOptions: makeDefaults(),
      maxIterations: 30,
    },
    draggedNode: undefined,
    draggingPointerId: undefined,
    pinPos: undefined,
    selectedNodes: [],
    selectionMode: "single",
  }
  return {
    getState: () => state,
    setState(newState: Partial<AppState>) {
      state = Object.freeze({
        ...state,
        ...newState,
      })
    },
  }
}

export function updateModel(
  store: Store<AppState>,
  updateFn: (m: Model) => void,
): void {
  const { model } = store.getState()
  store.setState({
    model: immer.produce(model, updateFn),
  })
}

export function setSelectionMode(
  store: Store<AppState>,
  mode: "single" | "multi",
) {
  store.setState({
    selectionMode: mode,
    selectedNodes: [],
  })
}

export function selectNode(store: Store<AppState>, node: Node) {
  const state = store.getState()
  store.setState({
    selectedNodes:
      state.selectionMode === "single"
        ? [node]
        : [...state.selectedNodes, node],
  })
}

export function clearSelection(store: Store<AppState>) {
  store.setState({ selectedNodes: [] })
}
