import * as k from "../core/api"
import * as v from "./vec2"
import * as u from "./variable"

export interface TurtleSegment {
  from: v.Vec2
  to: v.Vec2
  length: k.Num
  visible: boolean
}

type Label = NumLabel | TextLabel

interface NumLabel {
  type: "num"
  point: v.Vec2
  value: k.Num
}

interface TextLabel {
  type: "text"
  point: v.Vec2
  value: string
}

export function reverse(seg: TurtleSegment): TurtleSegment {
  return {
    from: seg.to,
    to: seg.from,
    length: seg.length,
    visible: seg.visible,
  }
}

export interface DisplaySegment {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface DisplayLabel {
  x: number
  y: number
  text: string
}

function constraintLoss(c: Constraint): k.Num {
  const dx = k.sub(c.from.x, c.to.x)
  const dy = k.sub(c.from.y, c.to.y)
  const dist = k.sqrt(k.add(k.mul(dx, dx), k.mul(dy, dy)))
  const diff = k.sub(dist, c.length)
  return k.div(k.mul(diff, diff), k.mul(2, k.mul(c.sd, c.sd)))
}

interface Constraint {
  from: v.Vec2
  to: v.Vec2
  length: k.Num
  sd: number
}

export class Turtle {
  segments: TurtleSegment[]
  constraints: Constraint[]
  variables: u.Variable[]
  labels: Label[]
  position: v.Vec2
  direction: v.Vec2
  mouse: { x: k.Param; y: k.Param }
  mousePos: { x: number; y: number }
  params: Map<k.Param, number>
  isPenDown: boolean

  private prevLoss?: k.Num
  private optimizer?: k.Optimizer

  constructor() {
    this.segments = []
    this.position = v.origin
    this.direction = v.degrees(k.zero)
    this.params = new Map()
    this.variables = []
    this.constraints = []
    this.mouse = {
      x: k.observation("mouseX"),
      y: k.observation("mouseY"),
    }
    this.mousePos = { x: 1, y: 1 }
    this.isPenDown = true
    this.labels = []
  }

  penDown() {
    this.isPenDown = true
  }

  penUp() {
    this.isPenDown = false
  }

  constrain(from: v.Vec2, to: v.Vec2, length: k.AnyNum, sd: number = 1) {
    this.constraints.push({ from, to, length: k.num(length), sd })
  }

  mouseMove(x: number, y: number) {
    this.mousePos.x = x
    this.mousePos.y = y
  }

  forward(s: k.AnyNum): TurtleSegment {
    const d = v.scale(this.direction, s)
    const to = v.add(this.position, d)
    const seg = {
      from: this.position,
      to,
      length: k.num(s),
      visible: this.isPenDown,
    }
    this.segments.push(seg)
    this.position = to

    return seg
  }

  left(angle: v.Vec2): void {
    this.direction = v.subAngles(this.direction, angle)
  }

  right(angle: v.Vec2): void {
    this.direction = v.addAngles(this.direction, angle)
  }

  at(pt: v.Vec2) {
    this.constrain(this.position, pt, 0)
  }

  optimize(iterations: number, opts?: k.OptimizeOptions): void {
    // Reuse the optimizer as long as the loss function is unchanged.
    const loss = this.computeLoss()
    if (!this.optimizer || loss !== this.prevLoss) {
      this.optimizer = k.optimizer(loss, this.params)
      this.prevLoss = loss
    }
    const observations: Map<k.Param, number> = new Map()
    observations.set(this.mouse.x, this.mousePos.x)
    observations.set(this.mouse.y, this.mousePos.y)

    const ev = this.optimizer.optimize(iterations, observations, opts)
    this.params = ev.params
  }

  computeLoss(): k.Num {
    const varLosses = this.variables.map((vr) => vr.loss)
    const conLosses = this.constraints.map((c) => constraintLoss(c))
    const allLosses = varLosses.concat(conLosses)
    return allLosses.reduce(k.add)
  }

  displaySegments(): Array<DisplaySegment> {
    const ev = k.evaluator(this.params)
    return this.segments.map((vs, i) => {
      return {
        id: i,
        x1: ev.evaluate(vs.from.x),
        y1: ev.evaluate(vs.from.y),
        x2: ev.evaluate(vs.to.x),
        y2: ev.evaluate(vs.to.y),
      }
    })
  }
  
  displayLabels(): Array<DisplayLabel> {
    const ev = k.evaluator(this.params)
    return this.labels.map((l) => {
      const x = ev.evaluate(l.point.x)
      const y = ev.evaluate(l.point.y)
      let text = ""
      if(l.type == "text")
        text = l.value
      else
        text = Math.round(ev.evaluate(l.value)).toString()
      return {x,y,text}
    })
  }

  approxLength(name: string, len: k.AnyNum): k.Num {
    const lv = u.lengthVariable(name, k.num(len))
    this.variables.push(lv)
    return lv.value
  }

  anyAngle(name: string): v.Vec2 {
    const av = u.angleVariable(name)
    this.variables.push(av)
    const sin = av.value
    const cos = k.neg(k.sqrt(k.sub(k.one, k.mul(sin, sin))))
    return { x: cos, y: sin }
  }

  atMouse(sd: number = 100) {
    this.constrain(this.mouse, this.position, 0, sd)
  }

  label(value: k.Num | string) {
    if(typeof(value) == "string") {
      this.labels.push({
        type: "text",
        point: this.position,
        value
      })
    } else {
      this.labels.push({
        type: "num",
        point: this.position,
        value
      })
    }
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
}
