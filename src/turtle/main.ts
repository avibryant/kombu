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

//console.log(degrees(90))
const deg90 = vec2(0,1)

const t = new Turtle()
const o = t.position
t.forward(t.approxLength(200))
t.right(deg90)
t.forward(t.approxLength(200))
t.right(deg90)
t.forward(t.approxLength(200))
t.right(deg90)
t.forward(t.approxLength(200))
t.at(o)

const ctx = canvas.getContext("2d")!

ctx.lineWidth = 1
ctx.strokeStyle = "black"

t.segments().forEach((s) => {
  ctx.beginPath()
  ctx.moveTo(s.x1,s.y1)
  ctx.lineTo(s.x2,s.y2)
  ctx.stroke()  
})

