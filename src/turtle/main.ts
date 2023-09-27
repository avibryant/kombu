import './style.css'
import {Turtle} from './turtle'
import {degrees, vec2} from './vec2'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <canvas id="canvas"></canvas>
  </div>
`
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!

function resizeCanvas() {
  canvas.width = window.innerWidth - canvas.offsetLeft
  canvas.height = window.innerHeight - canvas.offsetTop
}

resizeCanvas()

const t = new Turtle()
const o = t.position
t.forward(t.approxLength(100))
t.right(t.anyAngle())
t.forward(t.approxLength(200))
t.right(t.anyAngle())
t.forward(t.approxLength(300))
t.at(o)

const ctx = canvas.getContext("2d")!


function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let i = 0
while(i < 1000) {
  t.optimize(1)

  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 1
  ctx.strokeStyle = "white"
    t.segments().forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(s.x1,s.y1)
    ctx.lineTo(s.x2,s.y2)
    ctx.stroke()  
  })

  i += 1
  await sleep(10)
}
