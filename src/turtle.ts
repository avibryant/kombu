import * as t from './types'
import * as c from './construct'
import * as n from './num'
import * as v from './vec2'
import * as p from './stats'
import {optimize} from './optimize'

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
    loss: t.Num
    position: v.Vec2
    direction: v.Vec2
    counter: number

    constructor() {
        this.vecSegments = []
        this.loss = c.zero
        this.position = v.origin
        this.direction = v.degrees(c.zero)
        this.counter = 0
    }

    forward(s: n.AnyNum): v.Vec2 {
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
        const fn = optimize(this.loss, new Map())
        return this.vecSegments.map((vs) => {
            return {
                x1: fn(vs.from.x),
                y1: fn(vs.from.y),
                x2: fn(vs.to.x),
                y2: fn(vs.to.y)
            }
        })
    }

    someLength(mean: number = 100): t.Num {
        this.counter += 1
        const pr = p.uniformPrior("d" + this.counter)
        const d = n.mul(pr.value, mean)
        this.loss = n.sub(this.loss, pr.logp)
        return d
    }
}