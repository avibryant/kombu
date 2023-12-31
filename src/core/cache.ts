import { assert } from "./assert"
import * as t from "./types"

//use WeakRef, GC op that deletes expired refs
const map = new Map<number, t.Num>()

// From http://www.isthe.com/chongo/tech/comp/fnv/index.html#FNV-param
const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

// Precomputed starting hash for each of the types.
const INITIAL_HASH_CONSTANT = (FNV_OFFSET_BASIS ^ 0) * FNV_PRIME
const INITIAL_HASH_PARAM = (FNV_OFFSET_BASIS ^ 1) * FNV_PRIME
const INITIAL_HASH_SUM = (FNV_OFFSET_BASIS ^ 2) * FNV_PRIME
const INITIAL_HASH_PRODUCT = (FNV_OFFSET_BASIS ^ 3) * FNV_PRIME
const INITIAL_HASH_UNARY = (FNV_OFFSET_BASIS ^ 4) * FNV_PRIME

export function cacheNum<T extends t.Num>(n: T): T {
  const key = hashcode(n)
  let res = map.get(key)
  if (res == undefined || !equal(res, n)) {
    map.set(key, n)
    res = n
  }
  return <T>res
}

const f64Array = new Float64Array(1)
const i32View = new Uint32Array(f64Array.buffer)

/*
  FNV1a, from http://www.isthe.com/chongo/tech/comp/fnv/index.html —

    hash = offset_basis
    for each octet_of_data to be hashed
      hash = hash xor octet_of_data
      hash = hash * FNV_prime
    return hash

  */
function hashI32(hash: number, data: number): number {
  return (hash ^ data) * FNV_PRIME
}

function hashF64(hash: number, data: number): number {
  f64Array[0] = data
  hash = hashI32(hash, i32View[0])
  return hashI32(hash, i32View[1])
}

function hashString(hash: number, data: string): number {
  for (let i = 0, len = data.length; i < len; i++) {
    hash = hashI32(hash, data.charCodeAt(i))
  }
  return hash
}

function hashTerms<T extends t.ProductTerm | t.SumTerm>(
  hash: number,
  node: t.TermNode<T> | null,
): number {
  for (let n = node; n != null; n = n.nextTerm) {
    hash = hashF64(hash, n.a)
    hash = hashI32(hash, hashcode(n.x))
  }
  return hash
}

function hashcode(n: t.Num): number {
  // Don't cache the hashcode for Constants.
  switch (n.type) {
    case t.NumType.Constant:
      return hashF64(INITIAL_HASH_CONSTANT, n.value)
  }

  let hash = n.hashcode
  if (hash != null) return hash

  switch (n.type) {
    case t.NumType.Param:
      hash = hashF64(INITIAL_HASH_PARAM, n.id)
      break
    case t.NumType.Unary:
      hash = hashString(INITIAL_HASH_UNARY, n.fn)
      hash = hashI32(hash, hashcode(n.term))
      break
    case t.NumType.Product:
      hash = hashTerms(INITIAL_HASH_PRODUCT, n.firstTerm)
      break
    case t.NumType.Sum:
      hash = hashTerms(INITIAL_HASH_SUM, n.firstTerm)
      hash = hashF64(hash, n.k)
      break
  }
  n.hashcode = hash
  return hash
}

function termsEqual<T extends t.ProductTerm | t.SumTerm>(
  l: t.TermNode<T> | null,
  r: t.TermNode<T> | null,
): boolean {
  while (l != null && r != null) {
    if (l.a !== r.a || l.x !== r.x) return false
    l = l.nextTerm
    r = r.nextTerm
  }
  return true
}

const isConstant = (n: t.Num): n is t.Constant => n.type === t.NumType.Constant
const isParam = (n: t.Num): n is t.Param => n.type === t.NumType.Param
const isUnary = (n: t.Num): n is t.Unary => n.type === t.NumType.Unary
const isProduct = (n: t.Num): n is t.Product => n.type === t.NumType.Product
const isSum = (n: t.Num): n is t.Sum => n.type === t.NumType.Sum

function equal(a: t.Num | null, b: t.Num | null): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.type !== b.type) return false

  if (isConstant(a) && isConstant(b)) {
    return a.value === b.value
  } else if (isParam(a) && isParam(b)) {
    return a.id === b.id
  } else if (isUnary(a) && isUnary(b)) {
    return a.fn === b.fn && a.term === b.term
  } else if (isProduct(a) && isProduct(b)) {
    return termsEqual(a.firstTerm, b.firstTerm)
  } else if (isSum(a) && isSum(b)) {
    return termsEqual(a.firstTerm, b.firstTerm) && a.k === b.k
  }

  assert(false, "unreachable")
  return false
}

export const hashcodeForTesting = hashcode
