import * as k from "../core/api"
import * as v from "./vec2"

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
  vecSegments: Array<VecSegment>
  loss: k.Num
  position: v.Vec2
  direction: v.Vec2
  counter: number
  params: Map<k.Param, number>

  pinState?: {
    params: { x: k.Param; y: k.Param }
    unpinnedLoss: k.Num
  }

  private prevLoss?: k.Num
  private optimizer?: k.Optimizer

  constructor() {
    this.loss = k.zero
    this.vecSegments = []
    this.position = v.origin
    this.direction = v.degrees(k.zero)
    this.counter = 0
    this.params = new Map()
  }

  pin(segmentIdx: number, which: "from" | "to", x: number, y: number) {
    if (!this.pinState) {
      const x = k.observation("pinX")
      const y = k.observation("pinY")
      const vec = this.vecSegments[segmentIdx][which]
      const prx = k.normalLikelihood(k.sub(vec.x, x))
      const pry = k.normalLikelihood(k.sub(vec.y, y))
      this.pinState = {
        params: { x, y },
        unpinnedLoss: this.loss,
      }
      this.loss = k.sub(this.loss, k.add(prx, pry))
    }
    this.params.set(this.pinState.params.x, x)
    this.params.set(this.pinState.params.y, y)
  }

  unpin() {
    if (this.pinState) {
      this.loss = this.pinState.unpinnedLoss
      this.params.delete(this.pinState.params.x)
      this.params.delete(this.pinState.params.y)
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

  optimize(iterations: number): void {
    // Reuse the optimizer as long as the loss function is unchanged.
    if (!this.optimizer || this.loss !== this.prevLoss) {
      this.optimizer = k.optimizer(this.loss, this.params)
      this.prevLoss = this.loss
    }
    const ev = this.optimizer.optimize(iterations)
    this.params = ev.params
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

  approxLength(mean: number, sd: number = 20): k.Num {
    this.counter += 1
    const pr = k.normalPrior("d" + this.counter)
    this.loss = k.sub(this.loss, pr.logp)
    return k.softplus(k.add(k.mul(pr.value, sd), mean))
  }

  anyAngle(): v.Vec2 {
    this.counter += 1
    const raw = k.param("a" + this.counter)
    const sin = k.sub(k.mul(2, k.logistic(raw)), 1)
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
  at(pt: v.Vec2) {
    const prx = k.normalLikelihood(k.sub(this.position.x, pt.x))
    const pry = k.normalLikelihood(k.sub(this.position.y, pt.y))
    this.loss = k.sub(this.loss, k.add(prx, pry))
  }
}
