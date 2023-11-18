import * as d from './dag'
import {add} from './add'
import {powK} from './pow'
import {compare} from './compare'

export function mul(left: d.Num, right: d.Num): d.Num {
    if(d.isConstant(left)) {
        if(d.isConstant(right))
            return d.constant(left.value * right.value)
        else
            return mul_const(left, right)
    } else {
        if(d.isConstant(right))
            return mul_const(right, left)
        else
            return mul_nonconst(left, right)            
    }
}

export function mulK(left: d.Constant, right: d.NotMulKOrAdd): d.Num {
    if(left.value == 1)
        return right
    if(left.value == 0)
        return d.constant(0)
    return {
        type: "mul", left, right
    }
}

function mul_const(left: d.Constant, right: d.NotConstant): d.Num {
    if(d.isMul(right) && d.isMulK(right)) {
        return mulK(
            d.constant(left.value + right.left.value),
            right.right)
    } else if(d.isAdd(right)) {
        return add(mul(left, right.left), mul(left, right.right))
    } else 
        return mulK(left, right)
}

function mul_nonconst(left: d.NotConstant, right: d.NotConstant): d.Num {
    if(d.isMul(left)) {
        return mul(left.left, mul(left.right, right))
    } else if(d.isMul(right)) {
        return mul_nm_mul(left, right)
    } else {
        return mul_nm_nm(left, right)
    }
}

function mul_nm_mul(left: d.NotMul, right: d.Mul): d.Num {
    if(d.isMulK(right)) {
        return mul(right.left, mul(left, right.right))
    } else {
       return mul_nm_mr(left, right)
    }
}

function mul_nm_nm(left: d.NotMul, right: d.NotMul): d.Num {
    const m1 = termCoeff(left)
    const m2 = termCoeff(right)

    switch(compare(m1.term, m2.term)) {
        case "lt":
            return mulR(left, right)
        case "gt":
            return mulR(right, left)
        case "eq":
            return merge(m1, m2)
    }
}

function mul_nm_mr(left: d.NotMul, right: d.MulR): d.Num {
    const m1 = termCoeff(left)
    const m2 = termCoeff(right.left)
    switch(compare(m1.term, m2.term)) {
        case "lt":
            return mulR(left, right)
        case "gt":
            return mul(right.left, mul(left, right.right))
        case "eq":
            return mul(merge(m1, m2), right.right)
    }
}

interface TermCoeff {
    term: d.NotPowKOrMul
    coeff: number
}

function termCoeff(n: d.NotMul): TermCoeff {
    if(d.isPow(n) && d.isPowK(n))
        return {
            term: n.left,
            coeff: n.right.value
        }
    else
        return {
            term: n,
            coeff: 1
        }
}

function merge(left: TermCoeff, right: TermCoeff): d.Num {
    return powK(left.term, d.constant(left.coeff + right.coeff))
}

function mulR(left: d.NotMul, right: d.NotMulK): d.Num {
    return {
        type: "mul", left, right
    }
}