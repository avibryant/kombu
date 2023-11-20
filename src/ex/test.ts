import * as d from './dag'
import {add} from './add'
import {mul} from './mul'

const x = d.parameter(1)
const y = d.parameter(2)
const three = d.constant(3)

const xpy = mul(y, mul(three, y))

console.log(xpy)