import { turtle, forward, right, at, midpoint, jump, parallel } from "./turtle"
import { Model, someLength, someAngle } from "../model/model"

export function draw(m: Model) {
  const t = turtle(m)

  const side = someLength(m, "A")
  const a = someAngle(m, "a")

  const o = t.position
  const q = forward(t, side)
  const mid = midpoint(q)
  right(t, a)
  const r = forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)

  at(t, o)

  jump(t, mid)
  parallel(t, r)
  forward(t, side)
}
