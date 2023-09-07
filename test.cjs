let k = require("./dist/kombu.cjs")

let x = k.param("x")
let y = k.param("y")

let z = k.mul(x,x)
console.log(k.printNum(z))