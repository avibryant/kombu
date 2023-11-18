import * as d from './dag'
import {compare} from './compare'
import {mulK} from './mul'

export function add(left: d.Num, right: d.Num): d.Num {
    if(d.isConstant(left)) {
        if(d.isConstant(right))
            return d.constant(left.value + right.value)
        else
            return add_const(left, right)
    } else {
        if(d.isConstant(right))
            return add_const(right, left)
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
    if(d.isAdd(left)) {
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
        return add_na_ar(left, right)
    }
}

function add_na_na(left: d.NotAdd, right: d.NotAdd): d.Num {
    const m1 = termCoeff(left)
    const m2 = termCoeff(right)
    switch(compare(m1.term, m2.term)) {
        case "lt":
            return addR(left, right)
        case "gt":
            return addR(right, left)
        case "eq":
            return merge(m1, m2)
    }
}

function add_na_ar(left: d.NotAdd, right: d.AddR): d.Num {
    const m1 = termCoeff(left)
    const m2 = termCoeff(right.left)
    switch(compare(m1.term, m2.term)) {
        case "lt":
            return addR(left, right)
        case "gt":
            return add(right.left, add(left, right.right))
        case "eq":
            return add(merge(m1, m2), right.right)
    }
}

function addK(left: d.Constant, right: d.NotAddK): d.Num {
    if(left.value == 0)
        return right
    else 
        return {
            type: "add", left, right
        }
}

function addR(left: d.NotAdd, right: d.NotAddK): d.Num {
    return {
        type: "add", left, right
    }
}

interface TermCoeff {
    term: d.NotMulKOrAdd
    coeff: number
}

function termCoeff(n: d.NotAdd): TermCoeff {
    if(d.isMul(n) && d.isMulK(n))
        return {
            term: n.right,
            coeff: n.left.value
        }
    else
        return {
            term: n,
            coeff: 1
        }
}

function merge(left: TermCoeff, right: TermCoeff): d.Num {
    return mulK(d.constant(left.coeff + right.coeff), left.term)
}
