import * as d from './dag'

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
    return {
        type: "mul", left, right
    }
}

function mul_const(left: d.Constant, right: d.NotConstant): d.Num {

}

function mul_nonconst(left: d.NotConstant, right: d.NotConstant): d.Num {
}
