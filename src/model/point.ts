import * as k from "../core/api"

export interface Point {
  x: k.Num
  y: k.Num
}

export function point(x: k.AnyNum, y: k.AnyNum): Point {
  return {
    x: k.num(x),
    y: k.num(y),
  }
}

export function add(a: Point, b: Point): Point {
  return {
    x: k.add(a.x, b.x),
    y: k.add(a.y, b.y),
  }
}

export function sub(a: Point, b: Point): Point {
  return {
    x: k.sub(a.x, b.x),
    y: k.sub(a.y, b.y),
  }
}

export function scale(v: Point, s: k.AnyNum): Point {
  return {
    x: k.mul(v.x, s),
    y: k.mul(v.y, s),
  }
}

export function normalize(v: Point): Point {
  const x2 = k.mul(v.x, v.x)
  const y2 = k.mul(v.y, v.y)
  const mag = k.sqrt(k.add(x2, y2))
  return {
    x: k.div(v.x, mag),
    y: k.div(v.y, mag),
  }
}

export function distance(a: Point, b: Point) {
  const dx = k.sub(a.x, b.x)
  const dy = k.sub(a.y, b.y)
  return k.sqrt(k.add(k.mul(dx, dx), k.mul(dy, dy)))
}

export const origin = point(200, 200)
