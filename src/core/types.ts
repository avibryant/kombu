import { Bounds } from "./bounds"

export type Num = Constant | Param | Sum | Product | Unary

export enum NumType {
  Constant,
  Param,
  Sum,
  Product,
  Unary,
}

export interface Constant {
  readonly type: NumType.Constant
  readonly value: number
  readonly bounds: Bounds
}

export interface Param {
  readonly type: NumType.Param
  readonly id: number
  readonly name: string
  readonly bounds: Bounds
  readonly fixed: boolean
  hashcode?: number
}

export type SumTerm = Product | Unary | Param
export type ProductTerm = Sum | Unary | Param
export type Term = SumTerm | ProductTerm
export type Terms<A extends Term> = ReadonlyMap<A,number>

//a1x1 + a2x2 + ... + k
export interface Sum {
  readonly type: NumType.Sum
  readonly k: number
  readonly terms: Terms<SumTerm>
  readonly bounds: Bounds
  hashcode?: number
}

//x1^a1 * x2^a2 * ... * xn^an
export interface Product {
  readonly type: NumType.Product
  readonly terms: Terms<ProductTerm>
  readonly bounds: Bounds
  hashcode?: number
}

export type UnaryFn = "sign" | "abs" | "cos" | "sin" | "atan" | "exp" | "log"

export interface Unary {
  readonly type: NumType.Unary
  readonly fn: UnaryFn
  readonly term: Term
  readonly bounds: Bounds
  hashcode?: number
}
