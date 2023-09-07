let k = require("./dist/kombu.cjs")

let x = k.param("x")
let y = k.param("y")

let z = k.div(k.sqrt(x),y)
console.log(k.printNum(z))