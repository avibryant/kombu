import * as d from './dag'

export function pow(left: d.Num, right: d.Num): d.Num {
    if(d.isConstant(left)) {
        if(d.isConstant(right))
            return d.constant(Math.pow(left.value, right.value))
        else {
            if(left.value == 0 || left.value == 1)
                return left
            else
                return powR(left, right)
        }
    } else {
        if(d.isConstant(right)) {
            if(d.isPow(left) && d.isPowK(left))
                return powK(left.left, d.constant(left.right.value * right.value))
            else if(d.isMul(left)) {

            } else
                return powK(left, right)
        }
        else
            return powR(left, right)            
    }
}

export function powK(left: d.NotPowKOrMul, right: d.Constant): d.Num {
    if(right.value == 0)
        return d.constant(1)
    if(right.value == 1)
        return left
    return {
        type: "pow", left, right
    }
}

function powR(left: d.NotPowK, right: d.NotConstant): d.Num {
    return 
}