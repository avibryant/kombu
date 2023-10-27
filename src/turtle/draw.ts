import { turtle, forward, right } from "./turtle"
import { Model, someLength, someAngle, constrain } from "../model/model"

export function draw(m: Model) {
  const t = turtle(m)

  const side = someLength(m, "A")
  const a = someAngle(m, "a")

  const o = t.position
  forward(t, side)
  right(t, a)
  forward(t, side)
  right(t, a)
  forward(t, side)

  constrain(m, o, t.position, 0, 1)
}

/*
  const side = t.approxLength("A", 100)
  const angle = t.anyAngle("spin")
  const o = t.position
  t.right(angle)
//  t.right(angle)
  t.forward(side)
  t.right(degrees(90))
  t.penUp()
  t.forward(side)
  t.penDown()

  const d = t.position

  t.atMouse(0.1)
  t.label(side)
  t.right(degrees(90))
  t.forward(side)
  t.right(degrees(90))
  t.forward(side)

  t.constrain(o, d, 100)
  */
