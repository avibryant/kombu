import { expect, test } from "vitest"

import { hashcodeForTesting as hashcode } from "./cache"
import * as c from "./construct"

test("hashcode", () => {
  // Constants are equal on value
  expect(hashcode(c.constant(3.14))).toBe(hashcode(c.constant(3.14)))
  expect(hashcode(c.constant(3.14))).not.toBe(hashcode(c.constant(3.141)))

  // Params are equal on id
  const x = c.param("x")
  let x2 = c.param("x")
  expect(hashcode(x)).not.toBe(hashcode(x2))
  x2 = { ...x2, id: x.id, hashcode: undefined }
  expect(hashcode(x)).toBe(hashcode(x2))
})
