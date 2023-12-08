import { DEBUG_useDeterministicRNG } from "./debug"

// https://en.wikipedia.org/wiki/Linear_congruential_generator
export function lcg(x0: number) {
  // Use same params as ANSI C.
  const m = 2 ** 32
  const a = 1103515245
  const c = 12345
  let x = x0
  return () => {
    x = (a * x + c) % m
    return x / m
  }
}

// Use our own random number generation, since Math.random() can't be seeded.
const defaultRandom = lcg(
  DEBUG_useDeterministicRNG() ? 853570741 : Date.now() % 1e9,
)

export function standardNormalRandom(random = defaultRandom) {
  return (
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  )
}
