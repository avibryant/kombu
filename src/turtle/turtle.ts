import * as k from "../core/api"

import {Point, origin} from '../model/point'
import {Angle, degrees} from '../model/angle'
import {Model} from '../model/model'

export interface Turtle {
    position: Point
    direction: Angle
    penDown: boolean
    model: Model
}

export function turtle(model: Model): Turtle {
    return {
        position: origin,
        direction: degrees(0),
        penDown: true,
        model
    }
}

export function forward(t: Turtle, dist: k.AnyNum) {

}

export function left(t: Turtle, angle: Angle) {

}

export function right(t: Turtle, angle: Angle) {

}