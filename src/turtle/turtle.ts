import * as k from '../core/api'
import * as v from './vec2'

interface VecSegment {
    from: v.Vec2
    to: v.Vec2
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

    forward(s: k.AnyNum): v.Vec2 {
        const d = v.scale(this.direction, s)
        const to = v.add(this.position, d)
        this.vecSegments.push({from: this.position, to})
        this.position = to
        return to
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

    someLength(mean: number = 100): k.Num {
        this.counter += 1
        const pr = k.uniformPrior("d" + this.counter)
        const d = k.mul(pr.value, mean)
        this.loss = k.sub(this.loss, pr.logp)
        return d
    }
}