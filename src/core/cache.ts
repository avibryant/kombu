import fnv1a from "@sindresorhus/fnv1a"

import { assert } from "./assert"
import * as t from "./types"

const SIZEOF_F64 = 8
const SIZEOF_I32 = 4

const hashes = new WeakMap<t.Num, number>()

//use WeakRef, GC op that deletes expired refs
const map = new Map<number, t.Num>()

export function cacheNum<T extends t.Num>(n: T): T {
  const key = hashcode(n)
  let res = map.get(key)
  if (res == undefined || !equal(res, n)) {
    map.set(key, n)
    res = n
  }
  return <T>res
}

const f64ToBytes = (n: number) => new Uint8Array(new Float64Array([n]).buffer)
const i32ToBytes = (n: number) => new Uint8Array(new Uint32Array([n]).buffer)

function asciiToBytes(s: string) {
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    assert(s.charCodeAt(i) < 256, "not an ASCII char")
    bytes[i] = s.charCodeAt(i)
  }
  return bytes
}

function termsToArray<T extends t.ProductTerm | t.SumTerm>(
  node: t.TermNode<T> | null,
): t.TermNode<T>[] {
  const terms: t.TermNode<T>[] = []
  for (let n = node; n != null; n = n.nextTerm) {
    terms.push(n)
  }
  return terms
}

function termsToBytes<T extends t.ProductTerm | t.SumTerm>(
  node: t.TermNode<T> | null,
) {
  const terms = termsToArray(node)
  const bytes = new Uint8Array(terms.length * (SIZEOF_F64 + SIZEOF_I32))
  let offset = 0
  for (let i = 0; i < terms.length; i++) {
    bytes.set(f64ToBytes(terms[i].a), offset)
    offset += SIZEOF_F64
    bytes.set(i32ToBytes(hashcode(terms[i].x)), offset)
    offset += SIZEOF_I32
  }
  return bytes
}

// Compute a 32-bit hash using FNV-1a.
function computeHash(type: number, ...arrs: ArrayLike<number>[]): number {
  const totalLen = 1 + arrs.reduce((len, a) => a.length + len, 0)
  const bytes = new Uint8Array(totalLen)
  bytes[0] = type
  let offset = 0
  for (let i = 0; i < arrs.length; i++) {
    bytes.set(arrs[i], offset)
    offset += arrs[i].length
  }
  return Number(fnv1a(bytes, { size: 32 }))
}

function hashcode(n: t.Num): number {
  let code = hashes.get(n)
  if (code != null) return code

  switch (n.type) {
    case t.NumType.Constant:
      code = computeHash(n.type, f64ToBytes(n.value))
      break
    case t.NumType.Param:
      code = computeHash(n.type, f64ToBytes(n.id))
      break
    case t.NumType.Unary:
      code = computeHash(
        n.type,
        asciiToBytes(n.fn),
        i32ToBytes(hashcode(n.term)),
      )
      break
    case t.NumType.Product:
      code = computeHash(n.type, termsToBytes(n.firstTerm))
      break
    case t.NumType.Sum:
      code = computeHash(n.type, termsToBytes(n.firstTerm), f64ToBytes(n.k))
      break
  }
  hashes.set(n, code)
  return code
}

function termsEqual<T extends t.ProductTerm | t.SumTerm>(
  a: t.TermNode<T> | null,
  b: t.TermNode<T> | null,
): boolean {
  const aTerms = termsToArray(a)
  const bTerms = termsToArray(b)

  if (aTerms.length !== bTerms.length) return false

  for (let i = 0; i < aTerms.length; i++) {
    if (aTerms[i].a !== bTerms[i].a) return false
    if (!equal(aTerms[i].x, bTerms[i].x)) return false
  }
  return true
}

const isConstant = (n: t.Num): n is t.Constant => n.type === t.NumType.Constant
const isParam = (n: t.Num): n is t.Param => n.type === t.NumType.Param
const isUnary = (n: t.Num): n is t.Unary => n.type === t.NumType.Unary
const isProduct = (n: t.Num): n is t.Product => n.type === t.NumType.Product
const isSum = (n: t.Num): n is t.Sum => n.type === t.NumType.Sum

function equal(a: t.Num | undefined, b: t.Num | undefined): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (hashcode(a) !== hashcode(b)) return false
  if (a.type !== b.type) return false

  if (isConstant(a) && isConstant(b)) {
    return a.value === b.value
  } else if (isParam(a) && isParam(b)) {
    return a.id === b.id
  } else if (isUnary(a) && isUnary(b)) {
    return a.fn === b.fn && equal(a.term, b.term)
  } else if (isProduct(a) && isProduct(b)) {
    return termsEqual(a.firstTerm, b.firstTerm)
  } else if (isSum(a) && isSum(b)) {
    return termsEqual(a.firstTerm, b.firstTerm) && a.k === b.k
  }
  assert(false, "unreachable")
  return false
}

export const hashcodeForTesting = hashcode
