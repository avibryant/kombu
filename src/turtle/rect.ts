export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function contains(r: Rect, x: number, y: number) {
  const right = r.x + r.w
  const bottom = r.y + r.h
  return r.x <= x && x < right && r.y <= y && y < bottom
}
