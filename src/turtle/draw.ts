import { turtle, forward, right, turn, slightRight, slightLeft, sharpRight, sharpLeft, at, midpoint, jump, parallel } from "./turtle"
import { Model} from "../model/model"

export function draw(m: Model) {
  const t = turtle(m)

  const o = t.position

  const l = forward(t)
  const a = slightRight(t)

  for(let i = 0; i < 4; i++) {
    forward(t, l.length)
    turn(t, a.by)
  }
  
  at(t, o)
}
