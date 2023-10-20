import { Pane, TabPageApi } from "tweakpane"

import * as k from "../core/api"
import { checkNotNull } from "../core/assert"
import * as v from "./variable"

interface Subpanel {
  dispose: () => void
  refresh: () => void
}

interface VarInfo {
  value: number
  loss: number
}

interface DisplayState {
  ui: Subpanel
  data: VarInfo
}

function subpanel(parent: Pane | TabPageApi, label: string, data: VarInfo) {
  const sep = parent.addBlade({ view: "separator" })
  const bindings = [
    parent.addBinding(data, "value", { label }),
    parent.addBinding(data, "loss"),
    parent.addBinding(data, "loss", {
      readonly: true,
      view: "graph",
      min: 0,
      max: 1,
      label: "",
    }),
  ]

  return {
    refresh() {
      bindings.forEach((b) => b.refresh())
    },
    dispose() {
      bindings.forEach((b) => b.dispose())
      sep.dispose()
    },
  }
}

function lossSubpanel(parent: Pane | TabPageApi, data: { loss: number }) {
  return parent.addBinding(data, "loss", {
    label: "total loss",
    readonly: true,
    view: "graph",
    min: 0,
    max: data.loss,
  })
}

export function createPanel() {
  let displayState: Map<v.Variable, DisplayState> = new Map()
  let pane = new Pane()
  const tab = pane.addTab({
    pages: [{ title: "Parameters" }, { title: "Config" }],
  })
  const paramsPage = tab.pages[0]

  let lossp: ReturnType<Pane["addBinding"]>
  const lossData = { loss: 0 }

  return {
    render(totalLoss: k.Num, varList: v.Variable[], ev: k.Evaluator) {
      // Lazily create the subpanel showing total loss.
      lossData.loss = ev.evaluate(totalLoss)
      if (lossp) {
        lossp.refresh()
      } else {
        lossp = lossSubpanel(paramsPage, lossData)
      }

      // Create or update subpanels for each variable.
      const vars = new Set(varList)
      const removed = Array.from(displayState.keys()).filter(
        (v) => !vars.has(v),
      )
      const added = Array.from(vars.keys()).filter((v) => !displayState.has(v))

      removed.forEach((v) => {
        const { ui } = checkNotNull(displayState.get(v))
        ui.dispose()
        displayState.delete(v)
      })

      added.forEach((v) => {
        const data = {
          value: ev.evaluate(v.value),
          loss: ev.evaluate(v.loss),
        }
        const ui = subpanel(paramsPage, v.param.name, data)
        displayState.set(v, {
          ui,
          data,
        })
      })

      displayState.forEach(({ ui, data }, v) => {
        data.value = ev.evaluate(v.value)
        data.loss = ev.evaluate(v.loss)
        ui.refresh()
      })
    },
  }
}
