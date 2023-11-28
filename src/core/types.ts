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
  type: NumType.Constant
  value: number
  bounds: Bounds
  hashcode?: number
}

export interface Param {
  type: NumType.Param
  id: number
  name: string
  bounds: Bounds
  fixed: boolean
  hashcode?: number
}

export type SumTerm = Product | Unary | Param
export type ProductTerm = Sum | Unary | Param
export type Term = SumTerm | ProductTerm
export interface TermNode<T extends ProductTerm | SumTerm> {
  a: number
  x: T
  nextTerm: TermNode<T> | null
}

//a1x1 + a2x2 + ... + k
export interface Sum {
  type: NumType.Sum
  id: number
  k: number
  firstTerm: TermNode<SumTerm>
  bounds: Bounds
  hashcode?: number
}

//x1^a1 * x2^a2 * ... * xn^an
export interface Product {
  type: NumType.Product
  id: number
  firstTerm: TermNode<ProductTerm>
  bounds: Bounds
  hashcode?: number
}

export type UnaryFn = "sign" | "abs" | "cos" | "sin" | "atan" | "exp" | "log"

export interface Unary {
  type: NumType.Unary
  id: number
  fn: UnaryFn
  term: Term
  bounds: Bounds
  hashcode?: number
}
