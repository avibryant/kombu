import htm from "htm"
import { h } from "preact"
import { useEffect, useState } from "preact/hooks"

const html = htm.bind(h)

export function Canvas(props: {
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
}) {
  const [width, setWidth] = useState(window.innerWidth)
  const [height, setHeight] = useState(window.innerHeight)

  const onResize = () => {
    setWidth(window.innerWidth)
    setHeight(window.innerHeight)
  }

  useEffect(() => {
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return html`
    <div>
      <canvas
        id="canvas"
        width=${width}
        height=${height}
        onPointerDown=${props.onPointerDown}
        onPointerMove=${props.onPointerMove}
        onPointerUp=${props.onPointerUp}
      >
      </canvas>
    </div>
  `
}
