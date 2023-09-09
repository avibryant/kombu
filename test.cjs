let k = require("./dist/kombu.cjs")

let x = k.param("x")
let y = k.param("y")

let z = k.mul(x, y)
console.log(k.tex(z))

let f = k.compile([x,y],[z,x,y])
let r = f([3,4])
console.log(r)