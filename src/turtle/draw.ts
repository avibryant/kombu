import { turtle, forward, right, slightRight, slightLeft, sharpRight, sharpLeft, at, midpoint, jump, parallel } from "./turtle"
import { Model} from "../model/model"

export function draw(m: Model) {
  const t = turtle(m)

  const o = t.position

  forward(t)
  sharpRight(t)
  forward(t, 100)
  slightRight(t)
  forward(t)
  
  at(t, o)
}
