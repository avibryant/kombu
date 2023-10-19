import htm from "htm"
import { Fragment, h } from "preact"
import { useEffect, useMemo, useState } from "preact/hooks"
import { FolderApi, Pane } from "tweakpane"

import * as k from "../core/api"

let prevParams: Map<k.Param, number> = new Map()
let pane: Pane

function renderPanel(params: Map<k.Param, number>) {
  if (!pane) {
    pane = new Pane()
  }
  params.forEach((v, p) => {
    if (prevParams.has(p)) {

    }
  })
  prevParams = new Map(params)
}

const html = htm.bind(h)

export function Panel(props: { params: Map<k.Param, number> }) {
  let pane = useMemo(() => new Pane(), [])

  useEffect(() => {
    return () => {
      pane.dispose()
    }
  }, [])

  const paramChildren = Array.from(props.params).map(([p, v]) => {
    return html`<${ParamDetails} pane=${pane} key=${p.name} param=${p} value=${v} />`
  })

  return html`<${Fragment}>${paramChildren}<//>`
}

function ParamDetails(props: { pane: Pane; param: k.Param; value: number }) {
  const { pane, param, value } = props

  const data = useMemo(() => ({ value }), [])
  data.value = value
  pane.refresh()

  // onMount
  useEffect(() => {
    const f = pane.addFolder({
      title: param.name,
    })
    f.addBinding(data, "value")

    return () => {
      f.dispose()
    }
  }, [])
}
