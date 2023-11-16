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
    if(d.isConstant(left)) {
        if(d.isConstant(right))
            return d.constant(left.value + right.value)
        else
            return add_const(left, right)
    } else {
        if(d.isConstant(right))
            return unreachable()
        else
            return add_nonconst(left, right)            
    }
}

function add_const(left: d.Constant, right: d.NotConstant): d.Num {
    if(d.isAdd(right) && d.isAddK(right)) {
        return addK(
            d.constant(left.value + right.left.value),
            right.right)
    } else
        return addK(left, right)
}


function add_nonconst(left: d.NotConstant, right: d.NotConstant): d.Num {
    if(d.isAdd(left) {
        return add(left.left, add(left.right, right))
    } else if(d.isAdd(right)) {
        return add_na_add(left, right)
    } else {
        return add_na_na(left, right)
    }
}

function add_na_add(left: d.NotAdd, right: d.Add): d.Num {
    if(d.isAddK(right)) {
        return add(right.left, add(left, right.right))
    } else {
        const maybeMerged = add_na_na(left, right.left)
        if(d.isAdd(maybeMerged)) {
            //TODO
        } else {
            return add(maybeMerged, right.right)
        }
    }
}

function add_na_na(left: d.NotAdd, right: d.NotAdd): d.Num {

}

function addK(left: d.Constant, right: d.NotAddK): d.Num {
    if(left.value == 0)
        return right
    else 
        return {
            type: "add", left, right
        }
}