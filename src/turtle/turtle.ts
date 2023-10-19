import * as k from "../core/api"
import * as v from "./vec2"
import * as u from "./variable"

export interface VecSegment {
  from: v.Vec2
  to: v.Vec2
}

export function reverse(seg: VecSegment): VecSegment {
  return {
    from: seg.to,
    to: seg.from,
  }
}

export interface Segment {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
}

function atLoss(from: v.Vec2, to: v.Vec2): k.Num {
  const dx = k.sub(from.x, to.x)
  const dy = k.sub(from.y, to.y)
  return k.div(k.add(k.mul(dx, dx), k.mul(dy, dy)), 2)
}

export class Turtle {
  vecSegments: VecSegment[]
  ats: VecSegment[]
  variables: u.Variable[]
  position: v.Vec2
  direction: v.Vec2
  params: Map<k.Param, number>

  pinState?: {
    pin: { x: k.Param; y: k.Param }
    point: v.Vec2
    observation: { x: number; y: number }
  }

  private prevLoss?: k.Num
  private optimizer?: k.Optimizer

  constructor() {
    this.vecSegments = []
    this.position = v.origin
    this.direction = v.degrees(k.zero)
    this.params = new Map()
    this.variables = []
    this.ats = []
  }

  pin(segmentIdx: number, which: "from" | "to", x: number, y: number) {
    if (!this.pinState) {
      const pinX = k.observation("pinX")
      const pinY = k.observation("pinY")

      const point = this.vecSegments[segmentIdx][which]

      this.pinState = {
        pin: { x: pinX, y: pinY },
        point,
        observation: { x, y },
      }
    }
    this.pinState.observation = { x, y }
  }

  unpin() {
    if (this.pinState) {
      this.pinState = undefined
    }
  }

  forward(s: k.AnyNum): VecSegment {
    const d = v.scale(this.direction, s)
    const to = v.add(this.position, d)
    const seg = { from: this.position, to }
    this.vecSegments.push(seg)
    this.position = to

    return seg
  }

  left(angle: v.Vec2): void {
    this.direction = v.subAngles(this.direction, angle)
  }

  right(angle: v.Vec2): void {
    this.direction = v.addAngles(this.direction, angle)
  }

  at(pt: v.Vec2) {
    this.ats.push({ from: this.position, to: pt })
  }

  optimize(iterations: number): void {
    // Reuse the optimizer as long as the loss function is unchanged.
    const loss = this.computeLoss()
    if (!this.optimizer || loss !== this.prevLoss) {
      this.optimizer = k.optimizer(loss, this.params)
      this.prevLoss = loss
    }
    const observations: Map<k.Param, number> = new Map()
    if (this.pinState) {
      observations.set(this.pinState.pin.x, this.pinState.observation.x)
      observations.set(this.pinState.pin.y, this.pinState.observation.y)
    }
    const ev = this.optimizer.optimize(iterations, observations)
    this.params = ev.params
  }

  computeLoss(): k.Num {
    const varLosses = this.variables.map((vr) => vr.loss)
    const atLosses = this.ats.map((vs) => atLoss(vs.from, vs.to))
    let pinLosses: k.Num[] = []
    if (this.pinState) {
      pinLosses.push(atLoss(this.pinState.pin, this.pinState.point))
    }
    const allLosses = varLosses.concat(atLosses).concat(pinLosses)
    return allLosses.reduce(k.add)
  }

  segments(): Array<Segment> {
    const ev = k.evaluator(this.params)
    return this.vecSegments.map((vs, i) => {
      return {
        id: i,
        x1: ev.evaluate(vs.from.x),
        y1: ev.evaluate(vs.from.y),
        x2: ev.evaluate(vs.to.x),
        y2: ev.evaluate(vs.to.y),
      }
    })
  }

  approxLength(name: string, len: k.AnyNum): k.Num {
    const lv = u.lengthVariable(name, k.num(len))
    this.variables.push(lv)
    return lv.value
  }

  anyAngle(name: string): v.Vec2 {
    const av = u.angleVariable(name)
    this.variables.push(av)
    const sin = av.value
    const cos = k.neg(k.sqrt(k.sub(k.one, k.mul(sin, sin))))
    return { x: cos, y: sin }
  }

  /*
    anyLength(): k.Num {

    }


    somewhereOn(seg: VecSegment): v.Vec2 {

    }


    parallel(seg: VecSegment) {

    }

    jump(pt: v.Vec2) {

    }
*/
}
