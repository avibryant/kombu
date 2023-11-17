import * as d from './dag'
import {add} from './add'
import {powK} from './pow'
import {compare, equal} from './compare'

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
        const maybeMerged = mul_nm_nm(left, right.left)
        if(d.isMul(maybeMerged)) {
            //TODO
        } else {
            return mul(maybeMerged, right.right)
        }
    }
}

function mul_nm_nm(left: d.NotMul, right: d.NotMul): d.Num {
    const m1 = termCoeff(left)
    const m2 = termCoeff(right)
    if(equal(m1.term, m2.term)) {
        return powK(m1.term, d.constant(m1.coeff + m2.coeff))
    } else {
        if(compare(left, right) == "lt")
            return mulR(left, right)
        else
            return mulR(right, left)
    }
}

interface TermCoeff {
    term: d.NotPowK
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

function mulR(left: d.NotMul, right: d.NotMul): d.Num {
    return {
        type: "mul", left, right
    }
}