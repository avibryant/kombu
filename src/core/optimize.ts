import * as t from './types'
import * as e from './eval'
import * as g from './grad'
import {tex} from './tex'

export function optimize(loss: t.Num, init: Map<t.Param,number>): e.Evaluator {
    console.log("loss = " + tex(loss))
    const gradient = g.gradient(loss)
    const params = new Map(init)
    gradient.forEach((_,k) => {
        if(!params.has(k))
            params.set(k,Math.random())
    })

    const epsilon = 0.0001
    let iterations = 100000
    while(iterations > 0) {
        const ev = e.evaluator(params)
        const l = ev(loss)
        if(iterations % 1000 == 0) {
            console.log(l)
        }
        gradient.forEach((v,k) => {
            const diff = ev(v)
            const old = params.get(k) || 0
            const update = old - (diff * epsilon)
            params.set(k, update)
        })
        iterations = iterations - 1
    }

    params.forEach((v,k) => {
        console.log(k.name + " = " + v)
    })

    return e.evaluator(params)
}
