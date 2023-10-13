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
