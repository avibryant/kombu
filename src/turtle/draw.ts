import { turtle, forward, right, at} from "./turtle"
import { Model, someLength, someAngle, constrain } from "../model/model"

export function draw(m: Model) {
  const t = turtle(m)

  const side = someLength(m, "A")
  const a = someAngle(m, "a")

  const o = t.position

  forward(t, side)

  const q = t.position

  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)

  at(t, o)

  constrain(m, o, q, 100, 10, {up: "s", down: "a"})
}
