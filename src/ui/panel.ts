import { Pane, TabPageApi } from "tweakpane"

import * as k from "../core/api"
import { checkNotNull } from "../core/assert"
import { defaultOptions } from "../core/wasmopt"
import {Model} from '../model/model'
import * as v from "../model/variable"

interface Config {
  bgColor: string
  fgColor: string
  optimization: k.OptimizeOptions
  iterations: number
}

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

function safelyAssign<T, K extends keyof T>(obj: T, key: K, val: any): void {
  // Only overwrite the field if the runtime types match.
  if (typeof val === typeof obj[key]) {
    obj[key] = val as T[K]
  }
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

function configSubpanel(parent: Pane | TabPageApi, mutableConfig: Config) {
  parent.addBinding(mutableConfig, "iterations", {
    format: (v) => v.toFixed(0),
    step: 1000,
    min: 1000,
    max: 20000,
  })
  ;[
    parent.addBinding(mutableConfig.optimization, "learningRate", {
      label: "lr",
    }),
    parent.addBinding(mutableConfig.optimization, "epsilon"),
    parent.addBinding(mutableConfig.optimization, "gamma"),
  ].forEach((binding) => {
    binding.on("change", () => {
      saveConfig(mutableConfig)
    })
  })

  const btn = parent.addButton({ title: "Restore defaults" })
  btn.on("click", () => {
    Object.assign(mutableConfig.optimization, defaultOptions)
    mutableConfig.iterations = 10000
    parent.refresh()
  })
}

function colorsSubpanel(parent: Pane | TabPageApi, mutableConfig: Config) {
  parent.addBinding(mutableConfig, "bgColor", { view: "color" })
  parent.addBinding(mutableConfig, "fgColor", { view: "color" })
}

function saveConfig(config: Config) {
  localStorage.setItem("optimization", JSON.stringify(config.optimization))
}

function maybeRestoreConfig(mutableConfig: Config) {
  const saved = JSON.parse(localStorage.getItem("optimization") ?? "{}")
  if (saved) {
    safelyAssign(mutableConfig.optimization, "method", saved.method)
    safelyAssign(mutableConfig.optimization, "learningRate", saved.learningRate)
    safelyAssign(mutableConfig.optimization, "epsilon", saved.epsilon)
    safelyAssign(mutableConfig.optimization, "gamma", saved.gamma)
  }
  return !!saved
}

export function createPanel(mutableConfig: Config) {
  let displayState: Map<v.Variable, DisplayState> = new Map()
  let pane = new Pane()
  const tab = pane.addTab({
    pages: [{ title: "Parameters" }, { title: "Config" }],
  })
  const paramsPage = tab.pages[0]
  const configPage = tab.pages[1]

  if (maybeRestoreConfig(mutableConfig)) {
    configPage.refresh()
  }
  configSubpanel(tab.pages[1], mutableConfig)
  tab.pages[1].addBlade({ view: "separator" })
  colorsSubpanel(tab.pages[1], mutableConfig)

  let lossp: ReturnType<Pane["addBinding"]>
  const lossData = { loss: 0 }

  return {
    render(model: Model) {
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
