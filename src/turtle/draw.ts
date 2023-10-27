import { turtle, forward, right } from "./turtle"
import { Model, someLength, someAngle, constrain } from "../model/model"

export function draw(m: Model) {
  const t = turtle(m)

  const side = someLength(m, "A")
  const a = someAngle(m, "a")

  const o = t.position
  forward(t, side)

  constrain(m, o, t.position, 100, 10)
  
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)

  constrain(m, o, t.position, 0, 1)
}
