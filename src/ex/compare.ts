import * as d from "./dag"

const typeOrder = ["constant", "parameter", "unary", "add", "mul", "pow"]

type CompareResult = "lt" | "eq" | "gt"
export function compare(left: d.Num, right: d.Num): CompareResult {
    const li = typeOrder.indexOf(left.type) 
    const ri = typeOrder.indexOf(right.type)
    if(li < ri)
        return "lt"
    else if(li > ri)
        return "gt"
    else {
        switch(left.type) {
            case "constant":
                return consts(left, <d.Constant>right)
            case "add":
                return add(left, <d.Add>right)
            case "mul":
                return mul(left, <d.Mul>right)
            case "parameter":
                return param(left, <d.Parameter>right)
            case "pow":
                return pow(left, <d.Pow>right)
            case "unary":
                return unary(left, <d.Unary>right)
        }
    }
}

function consts(left: d.Constant, right: d.Constant): CompareResult {
    if(left.value < right.value)
        return "lt"
    else if(left.value > right.value)
        return "gt"
    else
        return "eq"
}

function param(left: d.Parameter, right: d.Parameter): CompareResult {
    return compareNum(left.id, right.id)   
}


function unary(left: d.Unary, right: d.Unary): CompareResult {
    switch(compare(left.child, right.child)) {
        case "lt":
            return "lt"
        case "gt":
            return "gt"
        case "eq":
            return compareString(left.op, right.op)
    }
}

function add(left: d.Add, right: d.Add): CompareResult {
    return binary(left.left, left.right, right.left, right.right)
}

function mul(left: d.Mul, right: d.Mul): CompareResult {
    return binary(left.left, left.right, right.left, right.right)
}

function pow(left: d.Pow, right: d.Pow): CompareResult {
    return binary(left.left, left.right, right.left, right.right)
}


function binary(ll: d.Num, lr: d.Num, rl: d.Num, rr: d.Num): CompareResult {
    return compare(min(ll, lr), min(rl, rr))
}

function min(left: d.Num, right: d.Num): d.Num {
    if(compare(left, right) == "lt")
        return left
    else
        return right
}

function compareString(left: string, right: string): CompareResult {
    if(left < right)
        return "lt"
    else if(right < left)
        return "gt"
    else
        return "eq"
}

function compareNum(left: number, right: number): CompareResult {
    if(left < right)
        return "lt"
    else if(right < left)
        return "gt"
    else
        return "eq"
}