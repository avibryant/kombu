import { Pane, TabPageApi } from "tweakpane"

import * as k from "../core/api"
import { checkKeyOf, checkNotNull } from "../core/assert"
import {
  GradientDescentOptions,
  LBFGSOptions,
  defaultOptions,
  makeDefaults,
} from "../core/options"
import { Constraint } from "../model/constraint"
import { totalLoss, Model } from "../model/model"

interface Config {
  bgColor: string
  fgColor: string
  method: k.OptimizeOptions["method"]
  optimizeOptions: {
    LBFGS: LBFGSOptions
    GradientDescent: GradientDescentOptions
  }
  maxIterations: number
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

function deepAssign<T>(dest: T, src: any) {
  if (src == null) return

  for (const prop in dest) {
    let k = checkKeyOf(dest, prop)
    if (typeof dest[k] === "object") {
      deepAssign(dest[k], src[k])
    } else {
      safelyAssign(dest, k, src[k])
    }
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

function configSubpanel(
  parent: Pane | TabPageApi,
  mutableConfig: Config,
  onChange: () => void,
) {
  const methodList = parent.addBinding(mutableConfig, "method", {
    view: "list",
    options: [
      { text: "L-BFGS", value: "LBFGS" },
      { text: "Gradient descent", value: "GradientDescent" },
    ],
  })
  const lbfgsControls = [
    parent.addBinding(mutableConfig.optimizeOptions.LBFGS, "epsilon", {}),
    parent.addBinding(mutableConfig.optimizeOptions.LBFGS, "m", { step: 1 }),
  ]
  const gradientDescentControls = [
    parent.addBinding(
      mutableConfig.optimizeOptions.GradientDescent,
      "learningRate",
      {
        label: "learning rate",
      },
    ),
  ]
  const updateVisibility = () => {
    lbfgsControls.forEach((c) => (c.hidden = mutableConfig.method !== "LBFGS"))
    gradientDescentControls.forEach(
      (c) => (c.hidden = mutableConfig.method !== "GradientDescent"),
    )
  }
  methodList.on("change", updateVisibility)
  updateVisibility()

  const iter = parent.addBinding(mutableConfig, "maxIterations", {
    label: "max iter",
    step: 10,
    min: 10,
    max: 1000,
  })

  ;[methodList, ...lbfgsControls, ...gradientDescentControls, iter].forEach(
    (binding) => {
      binding.on("change", onChange)
    },
  )

  const btn = parent.addButton({ title: "Restore defaults" })
  btn.on("click", () => {
    mutableConfig.method = defaultOptions.method
    mutableConfig.bgColor = "#000"
    mutableConfig.fgColor = "#fff"
    deepAssign(mutableConfig.optimizeOptions, makeDefaults())
    mutableConfig.maxIterations = 30
    parent.refresh()
  })
}

function colorsSubpanel(
  parent: Pane | TabPageApi,
  mutableConfig: Config,
  onChange: () => void,
) {
  ;[
    parent.addBinding(mutableConfig, "bgColor", { view: "color" }),
    parent.addBinding(mutableConfig, "fgColor", { view: "color" }),
  ].forEach((b) => b.on("change", onChange))
}

function saveConfig(config: Config) {
  localStorage.setItem("config", JSON.stringify(config))
}

function maybeRestoreConfig(mutableConfig: Config) {
  deepAssign(
    mutableConfig,
    JSON.parse(localStorage.getItem("config") ?? "null"),
  )
}

export function createPanel(mutableConfig: Config, onChange: () => void) {
  let displayState: Map<Constraint, DisplayState> = new Map()
  let pane = new Pane()
  const tab = pane.addTab({
    pages: [{ title: "Model" }, { title: "Config" }],
  })
  const modelPage = tab.pages[0]
  const configPage = tab.pages[1]

  maybeRestoreConfig(mutableConfig)
  configPage.refresh()

  const handleChange = () => {
    saveConfig(mutableConfig)
    onChange()
  }
  configSubpanel(tab.pages[1], mutableConfig, handleChange)
  tab.pages[1].addBlade({ view: "separator" })
  colorsSubpanel(tab.pages[1], mutableConfig, handleChange)

  let lossp: ReturnType<Pane["addBinding"]>
  const lossData = { loss: 0 }

  return {
    render(model: Model) {
      const { ev } = model
      const lossValue = totalLoss(model)
      // Lazily create the subpanel showing total loss.
      lossData.loss = ev.evaluate(lossValue)
      if (lossp) {
        lossp.refresh()
      } else {
        lossp = lossSubpanel(modelPage, lossData)
      }

      // Create or update subpanels for each variable.
      const constraints = new Set(model.constraints)
      const removed = Array.from(displayState.keys()).filter(
        (c) => !constraints.has(c),
      )
      const added = Array.from(constraints.keys()).filter(
        (v) => !displayState.has(v),
      )

      removed.forEach((c) => {
        const { ui } = checkNotNull(displayState.get(c))
        ui.dispose()
        displayState.delete(c)
      })

      added.forEach((c) => {
        const data = {
          value: ev.evaluate(c.value),
          loss: ev.evaluate(c.logP),
        }
        const ui = subpanel(modelPage, c.name, data)
        displayState.set(c, {
          ui,
          data,
        })
      })

      displayState.forEach(({ ui, data }, c) => {
        data.value = ev.evaluate(c.value)
        data.loss = ev.evaluate(c.logP)
        ui.refresh()
      })
    },
  }
}
