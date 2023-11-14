import * as d from './dag'
import {compare} from './compare'
import {mul} from './mul'

export function add(left: d.Num, right: d.Num): d.Num {
    switch(compare(left, right)) {
        case "eq":
            return mul(left, d.constant(2))
        case "lt":
            return add_lt(left, right)
        case "gt":
            return add_lt(right, left)
    }
}

function unreachable(): d.Num {
    throw new Error("should be unreachable")
}

function add_lt(left: d.Num, right: d.Num): d.Num {
    if(left.type == "constant") {
        if(right.type == "constant")
            return d.constant(left.value + right.value)
        else
            return add_const(left, right)
    } else {
        if(right.type == "constant")
            return unreachable()
        else
            return add_nonconst(left, right)            
    }
}

function add_const(left: d.Constant, right: d.NotConstant): d.Num {
    if(right.type == "add") {
        if(d.isAddK(right)){

        } else {
            return add_k(left, right)
        }
    } else {
        return add_k(left, right)
    }
}

function add_k(left: d.Constant, right: d.NotAddK): d.Num {
    return {
        type: "add", left, right
    }
}

function add_nonconst(left: d.NotConstant, right: d.NotConstant): d.Num {
    
}