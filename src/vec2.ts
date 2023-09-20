import * as t from './types'
import * as n from './num'
import * as c from './construct'

export interface Vec2 {
    x: t.Num
    y: t.Num
}

export function vec2(x: n.AnyNum, y: n.AnyNum): Vec2 {
    return {
        x: n.num(x),
        y: n.num(y)
    }
}

export function add(a: Vec2, b: Vec2): Vec2 {
    return {
        x: n.add(a.x, b.x),
        y: n.add(a.y, b.y)
    }
}

export function sub(a: Vec2, b: Vec2): Vec2 {
    return {
        x: n.sub(a.x, b.x),
        y: n.sub(a.y, b.y)
    }
}

export function scale(v: Vec2, s: n.AnyNum): Vec2 {
    return {
        x: n.mul(v.x, s),
        y: n.mul(v.y, s)
    }
}

const deg2rad = c.constant(Math.PI / 180)
export function degrees(d: n.AnyNum): Vec2 {
    const rad = n.mul(n.num(d), deg2rad)
    const x = n.cos(rad)
    const y = n.sin(rad)
    return {x,y}
}

export function normalize(v: Vec2): Vec2 {
    const x2 = n.mul(v.x, v.x)
    const y2 = n.mul(v.y, v.y)
    const mag = n.sqrt(n.add(x2, y2))
    return {
        x: n.div(v.x, mag),
        y: n.div(v.y, mag)
    }
}

/*
a.x = cos(A)
a.y = sin(A)
b.x = cos(B)
b.y = sin(B)
res.x = cos(A+B) = cos(A)cos(B) - sin(A)sin(B)
res.y = sin(A+B) = sin(A)cos(B) + cos(A)sin(B)
*/
export function addAngles(a: Vec2, b: Vec2): Vec2 {
    const x = n.sub(n.mul(a.x,b.x), n.mul(a.y, b.y))
    const y = n.add(n.mul(a.y,b.x), n.mul(a.x,b.y))
    return {x,y}
}

export function subAngles(a: Vec2, b: Vec2): Vec2 {
    const x = n.add(n.mul(a.x,b.x), n.mul(a.y, b.y))
    const y = n.sub(n.mul(a.y,b.x), n.mul(a.x,b.y))
    return {x,y}
}

export const origin = vec2(200, 200)
