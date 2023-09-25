import * as t from './types'
import * as e from './eval'
import * as g from './grad'

export function optimize(loss: t.Num, init: Map<t.Param,number>): e.Evaluator {
    const gradient = g.gradient(loss)
    const params = new Map(init)
    gradient.forEach((_,k) => {
        if(!params.has(k))
            params.set(k,Math.random())
    })

    const epsilon = 0.01
    let iterations = 10000
    while(iterations > 0) {
        const ev = e.evaluator(params)
        const l = ev(loss)
        if(iterations % 1000 == 0)
            console.log(l)
        gradient.forEach((v,k) => {
            const diff = ev(v)
            const old = params.get(k) || 0
            const update = old - (diff * epsilon)
            params.set(k, update)
        })
        iterations = iterations - 1
    }

    return e.evaluator(params)
}
