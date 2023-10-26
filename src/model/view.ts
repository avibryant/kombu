import {Node} from './node'
import {Evaluator} from '../core/eval'

export type View = SegmentView

export interface SegmentView {
    type: "segment"
    from: Node
    to: Node
    isVisible: boolean
}

export function segment(from: Node, to: Node, isVisible: boolean): SegmentView {
    return {
        type: "segment",
        from, to, isVisible
    }
}

export function renderView(view: View, ev: Evaluator, ctx: CanvasRenderingContext2D, strokeColor: string) {
    switch(view.type) {
        case "segment":
            renderSegment(view, ev, ctx, strokeColor)
            break
    }
}

function pt(node: Node, ev: Evaluator): {x: number, y: number} {
    return {
        x: ev.evaluate(node.point.x),
        y: ev.evaluate(node.point.y)
    }
}
function renderSegment(view: SegmentView, ev: Evaluator, ctx: CanvasRenderingContext2D, strokeColor: string) {
    const a = pt(view.from, ev)
    const b = pt(view.to, ev)

    ctx.beginPath()
    ctx.strokeStyle = strokeColor
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
}