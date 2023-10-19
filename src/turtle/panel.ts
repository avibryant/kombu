import { FolderApi, Pane } from "tweakpane"

import * as k from "../core/api"
import { checkNotNull } from "../core/assert"

interface DisplayState {
  folder: FolderApi
  data: { value: number }
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
    const { folder } = checkNotNull(displayState.get(p))
    folder.dispose()
    displayState.delete(p)
  })

  added.forEach((p) => {
    const folder = pane.addFolder({ title: p.name })
    const data = { value: checkNotNull(paramValues.get(p)) }
    folder.addBinding(data, "value")
    displayState.set(p, {
      folder,
      data,
    })
  })

  displayState.forEach(({ folder, data }, p) => {
    data.value = checkNotNull(paramValues.get(p))
    folder.refresh()
  })
}
