const hasOwn = <T>(x: T, k: string) =>
  Object.prototype.hasOwnProperty.call(x, k)

export function assert(cond: boolean, err: string): void {
  if (!cond) throw new Error(err)
}

export function assertUnreachable(_: never): void {
  throw new Error("should be unreachable")
}

export function checkNotNull<T>(x: T): NonNullable<T> {
  if (x == null) {
    throw new Error(`unexpected null: ${x}`)
  }
  return x
}

export function checkKeyOf<T, K extends keyof T>(x: T, k: string): K {
  if (hasOwn(x, k)) {
    return k as K
  }
  throw new Error(`object has no '${k}' property: ${x}`)
}
