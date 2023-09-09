let k = require("./dist/kombu.cjs")

let x = k.param("x")
let y = k.param("y")

let z = k.mul(x, y)
console.log(k.tex(z))

let dxy = k.sub(x,y)
let m = new Map()
m.set(x,3)
m.set(y,4)
let opt = k.optimize(k.mul(dxy,dxy),m)
console.log(opt(x))
console.log(opt(y))