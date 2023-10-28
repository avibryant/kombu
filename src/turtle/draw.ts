import { turtle, forward, right, at } from "./turtle"
import { Model, someLength, someAngle } from "../model/model"
import {degrees} from "../model/angle"

export function draw(m: Model) {
  const t = turtle(m)

  const side = someLength(m, "A")
  const a = degrees(90) //someAngle(m, "a")

  const o = t.position
  forward(t, 200)
  right(t, a)
  forward(t, 200)
  right(t, a)
  forward(t, 200)
  right(t, a)
  forward(t, side)

  at(t, o)
}
