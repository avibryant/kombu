import * as t from "./types"
import * as n from "./num"
import * as c from "./construct"

export function logistic(num: n.AnyNum): t.Num {
  return n.div(c.one, n.add(c.one, n.exp(n.neg(num))))
}

export function softplus(num: n.AnyNum): t.Num {
  return n.log(n.add(1, n.exp(num)))
}
