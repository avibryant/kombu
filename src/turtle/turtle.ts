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

interface Segment {
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

  constructor() {
    this.vecSegments = []
    this.loss = k.zero
    this.position = v.origin
    this.direction = v.degrees(k.zero)
    this.counter = 0
    this.params = new Map()
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

  optimize(iterations: number) {
    const ev = k.optimize(this.loss, this.params, iterations)
    this.params = ev.params
  }

  segments(): Array<Segment> {
    const ev = k.evaluator(this.params)
    return this.vecSegments.map((vs) => {
      return {
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
