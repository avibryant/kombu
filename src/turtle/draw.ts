import { turtle, forward } from "./turtle"
import {Model} from '../model/model'

export function draw(model: Model) {
  const t = turtle(model)
  
  forward(t, 100)
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
