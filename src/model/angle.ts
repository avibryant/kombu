
import * as k from "../core/api"

export interface Angle {
    cos: k.Num
    sin: k.Num
}

const deg2rad = Math.PI / 180
export function degrees(d: number): Angle {
  const rad = d * deg2rad
  const cos = k.num(Math.cos(rad))
  const sin = k.num(Math.sin(rad))
  return { cos, sin }
}

/*
cos(A+B) = cos(A)cos(B) - sin(A)sin(B)
sin(A+B) = sin(A)cos(B) + cos(A)sin(B)
*/
export function add(a: Angle, b: Angle): Angle {
  const cos = k.sub(k.mul(a.cos, b.cos), k.mul(a.sin, b.sin))
  const sin = k.add(k.mul(a.sin, b.cos), k.mul(a.cos, b.sin))
  return { cos, sin }
}

export function subAngles(a: Angle, b: Angle): Angle {
  const cos = k.add(k.mul(a.cos, b.cos), k.mul(a.sin, b.sin))
  const sin = k.sub(k.mul(a.sin, b.cos), k.mul(a.cos, b.sin))
  return { cos, sin }
} 