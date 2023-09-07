let k = require("./dist/kombu.cjs")

let x = k.param("x")
let y = k.param("y")

let z = k.mul(k.add(x,y), k.sub(x,y))
let g = k.gradient(z).get(x)
console.log(k.printNum(g))