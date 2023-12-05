// This module implements an L-BFGS optimizer using techniques from the
// following three books:
//
// - _Convex Optimization_ by Boyd and Vandenberghe, 2009 edition
// - _Engineering Optimization_ by Rao, 2009 edition
// - _Numerical Optimization_ by Nocedal and Wright, 1999 edition

import { ArrayOfDouble, double, int } from "./types"

/**
 * The first parameter is the point at which to evaluate the objective function,
 * and the second parameter is an output parameter to hold the gradient at that
 * point. The function should store the gradient in that output parameter and
 * then return the objective value.
 */
type Fn = (x: ArrayOfDouble, grad: ArrayOfDouble) => double

/** Configuration options for L-BFGS. */
interface Config {
  /**
   * The number of vector pairs to store for L-BFGS. See page 224 of Nocedal and
   * Wright.
   */
  m: int

  /** Constant for the Armijo condition. See page 37 of Nocedal and Wright. */
  armijo: double

  /** Constant for the Wolfe condition. See page 39 of Nocedal and Wright. */
  wolfe: double

  /** The minimum interval size for line search. */
  minInterval: int

  /** The maximum number of steps for line search. */
  maxSteps: int

  /** A small positive constant to add to a denominator that might be zero. */
  epsd: double
}

/**
 * All L-BFGS state that needs to be kept between iterations, other than the
 * current point.
 */

interface State {
  /** The previous point. */
  x: ArrayOfDouble

  /** The previous gradient. */
  grad: ArrayOfDouble

  /** See page 224 of Nocedal and Wright. */
  s_y: SY[]
}

interface SY {
  s: ArrayOfDouble
  y: ArrayOfDouble
}

function dot(u: ArrayOfDouble, v: ArrayOfDouble): double {
  let z = 0.0
  for (let i = 0; i < u.length; i++) z += u[i] * v[i]
  return z
}

/**
 * Return the line search step size, having set `x` to the new point.
 *
 * @param x0 the current point.
 * @param r the descent direction, preconditioned by L-BFGS.
 * @param fx0 the objective at `x0`.
 * @param grad the gradient at `x0`, and is then used as scratch space; don't
 *  depend on its value.
 * @param x the new point. */
function lineSearch(
  cfg: Config,
  f: Fn,
  x0: ArrayOfDouble,
  r: ArrayOfDouble,
  fx0: double,
  grad: ArrayOfDouble,
  x: ArrayOfDouble,
): double {
  const n = x.length

  const dufAtx0 = -dot(r, grad)

  let a = 0.0
  let b = Infinity
  let t = 1.0
  let j = 0

  for (;;) {
    for (let i = 0; i < n; i++) x[i] = x0[i] - t * r[i]

    if (Math.abs(a - b) < cfg.minInterval || j > cfg.maxSteps) break

    const fx = f(x, grad)
    const isArmijo = fx <= fx0 + cfg.armijo * t * dufAtx0
    const isWolfe = -dot(r, grad) >= cfg.wolfe * dufAtx0 // weak Wolfe condition

    if (!isArmijo) b = t
    else if (!isWolfe) a = t
    else break // found good interval

    if (b < Infinity) t = (a + b) / 2.0 // already found Armijo
    else t = 2.0 * a // did not find Armijo

    j++
  }

  return t
}

/**
 * Perform the first step of L-BFGS at point `x`, updating it and returning the
 * initial `State`.
 */
function firstStep(cfg: Config, f: Fn, x: ArrayOfDouble): State {
  const n = x.length
  const x0 = x.slice()

  const grad = new Array<f64>(n)
  const fx = f(x, grad)

  const r = grad.slice()
  lineSearch(cfg, f, x0, r, fx, grad, x)

  return { x: x0, grad: r, s_y: [] }
}

/** Information after a step of L-BFGS. */
interface Info {
  /** Data about previous steps. */
  state: State

  /** The objective value at the current point. */
  fx: double

  /** The preconditioned descent direction. */
  r: ArrayOfDouble

  /** The current point. */
  x: ArrayOfDouble

  /** The line search step size. */
  t: double
}

function replace(target: ArrayOfDouble, source: ArrayOfDouble): void {
  let i = target.length - 1
  while (i >= 0) {
    target[i] = source[i]
    i -= 1
  }
}

/** Perform L-BFGS steps on `x`, giving `stop`'s first non-`undefined` value. */
function stepUntil<T>(
  cfg: Config,
  f: Fn,
  x: ArrayOfDouble,
  state: State,
  stop: (info: Info) => T,
): T {
  const n = x.length
  const grad = new Array<f64>(n)

  const rho = new Array<f64>(cfg.m)
  const alpha = new Array<f64>(cfg.m)
  const q = new Array<f64>(n)
  const r = new Array<f64>(n)

  for (;;) {
    const fx = f(x, grad)

    if (state.s_y.length < cfg.m) {
      const s = new Array<f64>(n)
      for (let i = 0; i < n; i++) s[i] = x[i] - state.x[i]
      const y = new Array<f64>(n)
      for (let i = 0; i < n; i++) y[i] = grad[i] - state.grad[i]
      state.s_y.push({ s, y })
    } else {
      const sy = state.s_y[state.s_y.length - 1]
      const s = sy.s
      const y = sy.y

      for (let i = 0; i < n; i++) {
        s[i] = x[i] - state.x[i]
        y[i] = grad[i] - state.grad[i]
      }
    }
    state.s_y.unshift(state.s_y.pop()!)

    replace(state.x, x)
    replace(state.grad, grad)

    for (let j = 0; j < state.s_y.length; j++) {
      const sy = state.s_y[j]
      const s_j = sy.s
      const y_j = sy.y

      rho[j] = 1 / (dot(y_j, s_j) + cfg.epsd)
    }

    replace(q, grad)

    for (let j = 0; j < state.s_y.length; j++) {
      const sy = state.s_y[j]
      const s_j = sy.s
      const y_j = sy.y
      const alpha_j = rho[j] * dot(s_j, q)
      alpha[j] = alpha_j
      for (let i = 0; i < n; i++) q[i] -= alpha_j * y_j[i]
    }

    // see page 226 of Nocedal and Wright
    const sy = state.s_y[0]
    const s_k = sy.s
    const y_k = sy.y
    const gamma = dot(s_k, y_k) / (dot(y_k, y_k) + cfg.epsd)
    for (let i = 0; i < n; i++) r[i] = gamma * q[i]

    for (let j = state.s_y.length - 1; j >= 0; j--) {
      const sy = state.s_y[j]
      const s_j = sy.s
      const y_j = sy.y
      const alpha_j = alpha[j]
      const beta = rho[j] * dot(y_j, r)
      for (let i = 0; i < n; i++) r[i] += s_j[i] * (alpha_j - beta)
    }

    const t = lineSearch(cfg, f, state.x, r, fx, grad, x)

    const msg = stop({ state, fx, r, t, x })
    if (msg !== undefined) return msg
  }
}
