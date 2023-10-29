import { turtle, forward, right, at, midpoint } from "./turtle"
import { Model, someLength, someAngle } from "../model/model"

export function draw(m: Model) {
  const t = turtle(m)

  const side = someLength(m, "A")
  const a = someAngle(m, "a")

  const o = t.position
  const q = forward(t, side)
  midpoint(q)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)

  at(t, o)
}
