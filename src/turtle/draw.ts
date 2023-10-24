import { Turtle } from "./turtle"
import { degrees } from "./vec2"

export function draw(t: Turtle) {
  const side = t.approxLength("A", 100)

  const o = t.position
  t.forward(side)
  t.right(degrees(90))
  t.forward(side)

  const d = t.position

  t.atMouse()
  t.right(degrees(90))
  t.forward(side)
  t.right(degrees(90))
  t.forward(side)

  t.constrain(o, d, 100)
}
