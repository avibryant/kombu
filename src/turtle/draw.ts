import { turtle, forward, right, at } from "./turtle"
import { Model, someLength, someAngle } from "../model/model"
import * as k from "../core/api"

export function drawSquare(m: Model) {
  const t = turtle(m)

  const side = someLength(m, "A")
  const a = someAngle(m, "a")

  const o = t.position
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)

  at(t, o)
}

export function drawSierpinski(m: Model, nesting = 2) {
  const t = turtle(m)
  const side = someLength(t.model, "A", 100)
  const a = someAngle(m, "a")

  function triangle(depth: number) {
    const verts = [t.position]
    if (depth === 1) {
      const o = t.position
      forward(t, side)
      verts.push(t.position)
      right(t, a)
      forward(t, side)
      verts.push(t.position)
      right(t, a)
      forward(t, side)
      right(t, a)
      at(t, o)
    } else {
      const bigSide = k.mul(depth, side)
      let [_, v2, v3] = triangle(depth - 1)
      forward(t, k.div(bigSide, 2))
      at(t, v2)
      verts.push(triangle(depth - 1)[1])
      forward(t, k.div(bigSide, 2))
      right(t, a)
      forward(t, bigSide)
      right(t, a)
      forward(t, side)
      right(t, a)

      at(t, v3)
      verts.push(triangle(depth - 1)[2])
    }
    return verts
  }

  triangle(nesting)
}
