import * as t from './types'
import * as n from './num'
import * as c from './construct'

export interface Prior {
    value: t.Num
    logp: t.Num
}

export function logistic(num: n.AnyNum): t.Num {
    const negNum = n.neg(n.num(num))
    return n.div(c.one, n.add(c.one, n.exp(negNum)))
}

export function scale(prior: Prior, sigma: n.AnyNum): Prior {
    return {
        value: n.mul(prior.value, sigma),
        logp: n.sub(prior.logp, n.log(sigma))
    }
}

export function normalPrior(name: string): Prior {
    const v = c.param(name)
    return {
        value: v,
        logp: n.div(n.mul(v,v), -2)
    }
}

export function normalLikelihood(x: n.AnyNum): t.Num {
    const v = n.num(x)
    return n.div(n.mul(v,v), -2)
}

export function uniformPrior(name: string): Prior {
    const v = c.param(name)
    const value = logistic(v)
    const logp = n.add(n.log(value), n.log(n.sub(c.one, value)))
    return {value, logp} 
}