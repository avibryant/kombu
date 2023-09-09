let k = require("./dist/kombu.cjs")

let x = k.param("x")
let y = k.param("y")

let z = k.mul(x, k.mul(y,y))

let m = new Map()
m.set(x,3)
m.set(y,4)

/*
let opt = k.optimize(k.mul(dxy,dxy),m)
console.log(opt(x))
console.log(opt(y))
*/

console.log(k.tex(z))
console.log(k.tex(k.gradient(z).get(x)))
console.log(k.tex(k.gradient(z).get(y)))