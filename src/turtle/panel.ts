import { Pane } from "tweakpane"

import * as k from "../core/api"
import { checkNotNull } from "../core/assert"

interface Subpanel {
  dispose: () => void
  refresh: () => void
}

interface DisplayState {
  ui: Subpanel
  data: { value: number }
}

function subpanel(pane: Pane, label: string, data: { value: number }) {
  const binding = pane.addBinding(data, "value", { label })
  const sep = pane.addBlade({ view: "separator" })

  return {
    refresh() {
      binding.refresh()
    },
    dispose() {
      sep.dispose()
      binding.dispose()
    },
  }
}

// Internal render state.
// TODO: Consider passing this in as an argument.
let displayState: Map<k.Param, DisplayState> = new Map()
let pane: Pane

export function renderPanel(paramValues: Map<k.Param, number>) {
  if (!pane) pane = new Pane()

  const removed = Array.from(displayState.keys()).filter(
    (p) => !paramValues.has(p),
  )
  const added = Array.from(paramValues.keys()).filter(
    (p) => !displayState.has(p),
  )

  removed.forEach((p) => {
    const { ui } = checkNotNull(displayState.get(p))
    ui.dispose()
    displayState.delete(p)
  })

  added.forEach((p) => {
    const data = { value: checkNotNull(paramValues.get(p)) }
    const ui = subpanel(pane, p.name, data)
    displayState.set(p, {
      ui,
      data,
    })
  })

  displayState.forEach(({ ui, data }, p) => {
    data.value = checkNotNull(paramValues.get(p))
    ui.refresh()
  })

  // Avoid showing the final trailing separator.
  pane.children.forEach((c) => {
    c.hidden = false
  })
  const lastChild = pane.children.at(-1)
  if (lastChild) lastChild.hidden = true
}
