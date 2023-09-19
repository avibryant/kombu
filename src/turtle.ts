import * as t from './types'
import * as c from './construct'
import * as n from './num'
import * as v from './vec2'

interface Segment {
    from: v.Vec2
    to: v.Vec2
}

function segment(from: v.Vec2, to: v.Vec2): Segment {
    return {from, to}
}

export class Turtle {
    segments: Array<Segment>
    error: t.Num
    position: v.Vec2
    direction: v.Vec2

    constructor() {
        this.segments = []
        this.error = c.zero
        this.position = v.origin
        this.direction = v.degrees(c.zero)
    }

    forward(s: n.AnyNum): v.Vec2 {
        const d = v.scale(this.direction, s)
        const to = v.add(this.position, d)
        this.segments.push({from: this.position, to})
        this.position = to
        return to
    }

    left(angle: v.Vec2): void {
        this.direction = v.subAngles(this.direction, angle)
    }
}