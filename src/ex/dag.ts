export type Num = Constant | NotConstant

export interface Constant {
    type: "constant"
    value: number
}

export function constant(value: number): Constant {
    return {type: "constant", value}
}

export interface Parameter {
    type: "parameter"
    id: number
}

export function parameter(id: number): Parameter {
    return {type: "parameter", id}
}

export type Leaf = Constant | Parameter
export type NotLeaf = Binary | Unary
export type NotConstant = NotLeaf | Parameter
export type Binary = Mul | Add | Pow

export type UnaryP = Unary | Parameter

export type NotAdd = UnaryP | Mul | Pow
export type NotAddK = NotAdd | AddR
export type Add = AddR | AddK

export type NotMul = UnaryP | Add | Pow
export type NotMulK = NotMul | MulR
export type NotMulKOrAdd = UnaryP | Pow | MulR
export type Mul = MulK | MulR

export type NotPow = Constant | UnaryP | Mul | Add
export type NotPowK = NotPow | PowR
export type NotPowKOrMul = UnaryP | Add | PowR
export type Pow = PowK | PowR

export interface Unary {
    type: "unary"
    op: string
    child: NotConstant
}

export interface AddK {
    type: "add"
    left: Constant
    right: NotAddK
}

export interface AddR {
    type: "add"
    left: NotAdd
    right: NotAddK
}

export interface MulK {
    type: "mul"
    left: Constant
    right: NotMulKOrAdd
}

export interface MulR {
    type: "mul"
    left: NotMul
    right: NotMulK
}

export interface PowK {
    type: "pow"
    left: NotPowKOrMul
    right: Constant
}

export interface PowR {
    type: "pow"
    left: NotPowK
    right: NotConstant
}

export function isConstant(num: Num): num is Constant {
    return num.type == "constant"
}

export function isAdd(num: Num): num is Add {
    return num.type == "add"
}

export function isAddK(add: Add): add is AddK {
    return add.left.type == "constant"
}

export function isMul(num: Num): num is Mul {
    return num.type == "mul"
}

export function isMulK(mul: Mul): mul is MulK {
    return mul.left.type == "constant"
}

export function isPow(num: Num): num is Pow {
    return num.type == "pow"
}

export function isPowK(pow: Pow): pow is PowK {
    return pow.right.type == "constant"
}