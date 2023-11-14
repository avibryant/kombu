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
export type Mul = MulK | MulR

export type NotPow = UnaryP | Mul | Add
export type NotPowK = NotPow | PowR
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
    right: NotMulK
}

export interface MulR {
    type: "mul"
    left: NotMul
    right: NotMulK
}

export interface PowK {
    type: "pow"
    left: NotPowK
    right: Constant
}

export interface PowR {
    type: "pow"
    left: NotPowK
    right: NotConstant
}

export function isAddK(add: Add): add is AddK {
    return add.left.type == "constant"
}