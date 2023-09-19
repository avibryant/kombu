import './style.css'
import {Turtle} from './turtle'
import {param} from './construct'
import {degrees} from './vec2'

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
/*
const ctx = canvas.getContext("2d")!

ctx.lineWidth = 2
ctx.strokeStyle = "black"

ctx.beginPath()
ctx.moveTo(0,0)
ctx.lineTo(100,100)
ctx.stroke()
*/

const t = new Turtle()
t.forward(10)
t.left(degrees(90))
t.forward(10)
console.log(t.segments)