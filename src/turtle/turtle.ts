import * as k from '../core/api'
import * as v from './vec2'

export interface VecSegment {
    from: v.Vec2
    to: v.Vec2
}

export function reverse(seg: VecSegment): VecSegment {
    return {
        from: seg.to,
        to: seg.from
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

    constructor() {
        this.vecSegments = []
        this.loss = k.zero
        this.position = v.origin
        this.direction = v.degrees(k.zero)
        this.counter = 0
    }

    forward(s: k.AnyNum): VecSegment {
        const d = v.scale(this.direction, s)
        const to = v.add(this.position, d)
        const seg = {from: this.position, to}
        this.vecSegments.push(seg)
        this.position = to

        console.log("x = " + k.tex(this.position.x))
        console.log("y = " + k.tex(this.position.y))
        return seg
    }

    left(angle: v.Vec2): void {
        this.direction = v.subAngles(this.direction, angle)
    }

    right(angle: v.Vec2): void {
        this.direction = v.addAngles(this.direction, angle)
    }

    segments(): Array<Segment> {
        const fn = k.optimize(this.loss, new Map())
        return this.vecSegments.map((vs) => {
            return {
                x1: fn(vs.from.x),
                y1: fn(vs.from.y),
                x2: fn(vs.to.x),
                y2: fn(vs.to.y)
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
        const cos = k.neg(k.sqrt(k.sub(k.one, k.mul(sin,sin))))
        return {x: cos, y: sin}
    }

    /*
    anyLength(): k.Num {

    }
    

    somewhereOn(seg: VecSegment): v.Vec2 {

    }
*/

    parallel(seg: VecSegment) {

    }

    jump(pt: v.Vec2) {

    }

    at(pt: v.Vec2) {
        const prx = k.normalLikelihood(k.sub(this.position.x, pt.x))
        const pry = k.normalLikelihood(k.sub(this.position.y, pt.y))
        this.loss = k.sub(this.loss, k.add(prx, pry))
    }
}