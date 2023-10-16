import * as k from "../core/api"
import * as v from "./vec2"
import {Variable} from "./variable"

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

export class Turtle {
  vecSegments: VecSegment[]
  ats: VecSegment[]
  variables: Variable[]
  position: v.Vec2
  direction: v.Vec2
  params: Map<k.Param, number>

  pinState?: {
    mouseParams: { x: k.Param; y: k.Param }
    point: v.Vec2
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
      const x = k.observation("pinX")
      const y = k.observation("pinY")

      const point = this.vecSegments[segmentIdx][which]
      
      this.pinState = {
        mouseParams: { x, y },
        point
      }
    }
    this.params.set(this.pinState.mouseParams.x, x)
    this.params.set(this.pinState.mouseParams.y, y)
  }

  unpin() {
    if (this.pinState) {
      this.params.delete(this.pinState.mouseParams.x)
      this.params.delete(this.pinState.mouseParams.y)
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
    this.ats.push({from: this.position, to: pt})
  }

  optimize(iterations: number): void {
    // Reuse the optimizer as long as the loss function is unchanged.
    if (!this.optimizer || this.loss !== this.prevLoss) {
      this.optimizer = k.optimizer(this.loss, this.params)
      this.prevLoss = this.loss
    }
    const ev = this.optimizer.optimize(iterations, this.pinState?.observations)
    this.params = ev.params
  }

  computeLoss(): k.Num {
    //todo
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

  approxLength(name: string, mean: number, sd: number = 20): k.Num {
    //todo
  }

  anyAngle(): v.Vec2 {
    //todo
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
