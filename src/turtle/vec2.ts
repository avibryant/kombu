import * as k from "../core/api"

export interface Vec2 {
  x: k.Num
  y: k.Num
}

export function vec2(x: k.AnyNum, y: k.AnyNum): Vec2 {
  return {
    x: k.num(x),
    y: k.num(y),
  }
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return {
    x: k.add(a.x, b.x),
    y: k.add(a.y, b.y),
  }
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return {
    x: k.sub(a.x, b.x),
    y: k.sub(a.y, b.y),
  }
}

export function scale(v: Vec2, s: k.AnyNum): Vec2 {
  return {
    x: k.mul(v.x, s),
    y: k.mul(v.y, s),
  }
}

const deg2rad = k.num(Math.PI / 180)
export function degrees(d: k.AnyNum): Vec2 {
  const rad = k.mul(k.num(d), deg2rad)
  const x = k.cos(rad)
  const y = k.sin(rad)
  return { x, y }
}

export function normalize(v: Vec2): Vec2 {
  const x2 = k.mul(v.x, v.x)
  const y2 = k.mul(v.y, v.y)
  const mag = k.sqrt(k.add(x2, y2))
  return {
    x: k.div(v.x, mag),
    y: k.div(v.y, mag),
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
  const x = k.sub(k.mul(a.x, b.x), k.mul(a.y, b.y))
  const y = k.add(k.mul(a.y, b.x), k.mul(a.x, b.y))
  return { x, y }
}

export function subAngles(a: Vec2, b: Vec2): Vec2 {
  const x = k.add(k.mul(a.x, b.x), k.mul(a.y, b.y))
  const y = k.sub(k.mul(a.y, b.x), k.mul(a.x, b.y))
  return { x, y }
}

export function dist(a: Vec2, b: Vec2): k.Num {
  let dx = k.sub(b.x, a.x)
  let dy = k.sub(b.y, a.y)
  return k.sqrt(k.add(k.pow(dx, 2), k.pow(dy, 2)))
}

export const origin = vec2(200, 200)
