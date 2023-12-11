/*
  From https://github.com/penrose/penrose/blob/0ab136a32e8e8d7df2dc896d5702b499a6b4b594/packages/core/src/engine/Optimizer.ts

  MIT License

  Copyright (c) 2017

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

import * as lbfgs from "./lbfgs";

// see page 443 of Engineering Optimization, Fourth Edition
/**
 * Given an objective function `f` and some constraint functions `g_j`, where we
 * want to minimize `f` subject to `g_j(x) \leq 0` for all `j`, this function
 * computes the following, where `\lambda` is `weight`:
 *
 * `\phi(x, \lambda) = f(x) + \lambda * \sum_j \max(g_j(x), 0)^2`
 *
 * The gradient with respect to `x` is stored in `grad`.
 *
 * @param x input vector
 * @param weight `\lambda`, the weight of the constraint term
 * @param grad mutable array to store gradient in
 * @returns the augmented objective value `\phi(x, \lambda)`
 */
export type Fn = (
  x: Float64Array,
  weight: number,
  grad: Float64Array,
) => number;

export type OptStatus =
  | "UnconstrainedRunning"
  | "UnconstrainedConverged"
  | "EPConverged"
  | "Error";

// `n` is the size of the varying state
export interface LbfgsParams {
  lastState: Float64Array | undefined; // nx1 (col vec)
  lastGrad: Float64Array | undefined; // nx1 (col vec)
  s_list: Float64Array[]; // list of nx1 col vecs
  y_list: Float64Array[]; // list of nx1 col vecs
}

export interface Params {
  optStatus: OptStatus;
  /** Constraint weight for exterior point method */
  weight: number;
  /**  Info for unconstrained optimization */
  UOround: number;
  lastUOstate: Float64Array | undefined;
  lastUOenergy: number | undefined;

  /** Info for exterior point method */
  EPround: number;
  lastEPstate: Float64Array | undefined;
  lastEPenergy: number | undefined;

  lastGradient: Float64Array; // Value of gradient evaluated at the last state
  lastGradientPreconditioned: Float64Array; // Value of gradient evaluated at the last state, preconditioned by LBFGS
  // ^ Those two are stored to make them available to Style later

  // For L-BFGS
  lbfgsInfo: LbfgsParams;
}

// Returned after a call to `minimize`
interface OptInfo {
  xs: Float64Array;
  energyVal: number;
  normGrad: number;
  newLbfgsInfo: LbfgsParams;
  gradient: Float64Array;
  gradientPreconditioned: Float64Array;
  failed: boolean;
}

// From https://github.com/penrose/penrose/blob/97c8679a76b3dbcda9bec44bb3e81eee1f1ccb82/packages/core/src/utils/Util.ts#L109
function zip2<T1, T2>(a1: T1[], a2: T2[]): [T1, T2][] {
  const l = a1.length;
  if (l !== a2.length) {
    throw Error(
      `can't zip2 vectors of different length: ${a1.length} vs ${a2.length}`,
    );
  }
  const a: [T1, T2][] = [];
  for (let i = 0; i < l; i++) {
    a.push([a1[i], a2[i]]);
  }
  return a;
};

const log = {
  info(...args: any[]) {
    console.log(...args)
  },
  warn(...args: any[]) {
    console.log(...args)
  }
}

// Intial weight for constraints
const initConstraintWeight = 1e3;

const defaultLbfgsParams: LbfgsParams = {
  lastState: undefined,
  lastGrad: undefined,
  s_list: [],
  y_list: [],
};

// growth factor for constraint weights
const weightGrowthFactor = 10;

// EP method convergence criteria
const epStop = 1e-3;
// const epStop = 1e-5;
// const epStop = 1e-7;

// Unconstrained method convergence criteria
// TODO. This should REALLY be 10e-10
// NOTE: The new autodiff + line search seems to be really sensitive to this parameter (`uoStop`). It works for 1e-2, but the line search ends up with too-small intervals with 1e-5
const uoStop = 1e-2;
// const uoStop = 1e-3;
// const uoStop = 1e-5;
// const uoStop = 10;

const DEBUG_GRAD_DESCENT = false;
const BREAK_EARLY = true;

////////////////////////////////////////////////////////////////////////////////

const normList = (xs: Float64Array): number => {
  let sumSquares = 0;
  for (const x of xs) sumSquares += x * x;
  return Math.sqrt(sumSquares);
};

const subv = (xs: Float64Array, ys: Float64Array): Float64Array => {
  const zs = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) zs[i] = xs[i] - ys[i];
  return zs;
};

const dot = (xs: Float64Array, ys: Float64Array): number => {
  let z = 0;
  for (let i = 0; i < xs.length; i++) z += xs[i] * ys[i];
  return z;
};

const unconstrainedConverged = (normGrad: number): boolean => {
  if (DEBUG_GRAD_DESCENT)
    log.info("UO convergence check: ||grad f(x)||", normGrad);
  return normGrad < uoStop;
};

const epConverged = (
  xs0: Float64Array,
  xs1: Float64Array,
  fxs0: number,
  fxs1: number,
): boolean => {
  // TODO: These dx and dfx should really be scaled to account for magnitudes
  const stateChange = normList(subv(xs1, xs0));
  const energyChange = Math.abs(fxs1 - fxs0);
  log.info(
    "epConverged?: stateChange: ",
    stateChange,
    " | energyChange: ",
    energyChange,
  );

  return stateChange < epStop || energyChange < epStop;
};

// TODO. Annotate the return type: a new (copied?) state with the varyingState and opt params set?

// NOTE: `stepEP` implements the exterior point method as described here:
// https://www.me.utexas.edu/~jensen/ORMM/supplements/units/nlp_methods/const_opt.pdf (p7)

// Things that we should do programmatically improve the conditioning of the objective function:
// 1) scale the constraints so that the penalty generated by each is about the same magnitude
// 2) fix initial value of the penalty parameter so that the magnitude of the penalty term is not much smaller than the magnitude of objective function

/**
 * Steps the optimizer until either convergence or `stop` returns `true`.
 * @param f to compute objective, constraints, and gradient
 * @param x mutable array to update at each step
 * @param state initial optimizer state
 * @param stop early stopping criterion
 * @returns optimizer state after stepping
 */
export const stepUntil = (
  f: Fn,
  x: Float64Array,
  state: Params,
  stop: () => boolean,
): Params => {
  const optParams: Params = { ...state };
  const { optStatus, weight } = optParams;
  let xs = x;

  log.info("===============");
  log.info(
    "step | weight: ",
    weight,
    "| EP round: ",
    optParams.EPround,
    " | UO round: ",
    optParams.UOround,
  );

  switch (optStatus) {
    case "UnconstrainedRunning": {
      // NOTE: use cached varying values

      const res = minimize(f, xs, state.weight, state.lbfgsInfo, stop);
      xs = res.xs;

      // the new `xs` is put into the `newState`, which is returned at end of function
      // we don't need the updated xsVars and energyGraph as they are always cleared on evaluation; only their structure matters
      const {
        energyVal,
        normGrad,
        newLbfgsInfo,
        gradient,
        gradientPreconditioned,
        failed,
      } = res;

      optParams.lastUOstate = xs;
      optParams.lastUOenergy = energyVal;
      optParams.UOround++;
      optParams.lbfgsInfo = newLbfgsInfo;
      optParams.lastGradient = gradient;
      optParams.lastGradientPreconditioned = gradientPreconditioned;

      // NOTE: `varyingValues` is updated in `state` after each step by putting it into `newState` and passing it to `evalTranslation`, which returns another state

      // TODO. In the original optimizer, we cheat by using the EP cond here, because the UO cond is sometimes too strong.
      if (unconstrainedConverged(normGrad)) {
        optParams.optStatus = "UnconstrainedConverged";
        optParams.lbfgsInfo = defaultLbfgsParams;
        log.info(
          "Unconstrained converged with energy",
          energyVal,
          "gradient norm",
          normGrad,
        );
      } else {
        optParams.optStatus = "UnconstrainedRunning";
        // Note that lbfgs prams have already been updated
        log.info(
          "Took some steps. Current energy",
          energyVal,
          "gradient norm",
          normGrad,
        );
      }
      if (failed) {
        log.warn("Error detected after stepping");
        optParams.optStatus = "Error";
        return optParams;
      }

      break;
    }

    case "UnconstrainedConverged": {
      // No minimization step should be taken. Just figure out if we should start another UO round with higher EP weight.
      // We are using the last UO state and energy because they serve as the current EP state and energy, and comparing it to the last EP stuff.

      // Do EP convergence check on the last EP state (and its energy), and curr EP state (and its energy)
      // (There is no EP state or energy on the first round)
      // Note that lbfgs params have already been reset to default

      // TODO. Make a diagram to clarify vocabulary

      // We force EP to run at least two rounds (State 0 -> State 1 -> State 2; the first check is only between States 1 and 2)
      if (
        optParams.EPround > 1 &&
        epConverged(
          optParams.lastEPstate!,
          optParams.lastUOstate!,
          optParams.lastEPenergy!,
          optParams.lastUOenergy!,
        )
      ) {
        optParams.optStatus = "EPConverged";
        log.info("EP converged with energy", optParams.lastUOenergy);
      } else {
        // If EP has not converged, increase weight and continue.
        // The point is that, for the next round, the last converged UO state becomes both the last EP state and the initial state for the next round--starting with a harsher penalty.
        log.info(
          "step: UO converged but EP did not converge; starting next round",
        );
        optParams.optStatus = "UnconstrainedRunning";

        optParams.weight *= weightGrowthFactor;
        optParams.EPround++;
        optParams.UOround = 0;

        log.info(
          "increased EP weight to",
          optParams.weight,
          "in compiled energy and gradient",
        );
      }

      // Done with EP check, so save the curr EP state as the last EP state for the future.
      optParams.lastEPstate = optParams.lastUOstate;
      optParams.lastEPenergy = optParams.lastUOenergy;

      break;
    }

    case "EPConverged": {
      log.info("step: EP converged");
      return state;
    }

    case "Error": {
      log.warn("step: Error");
      return state;
    }
  }

  x.set(xs);
  return optParams;
};

const minimize = (
  f: Fn,
  xs0: Float64Array,
  weight: number,
  lbfgsInfo: LbfgsParams,
  stop: () => boolean,
): OptInfo => {
  // TODO: Do a UO convergence check here? Since the EP check is tied to the render cycle...

  log.info("-------------------------------------");
  log.info("minimize");

  const xs = new Float64Array(xs0); // Don't use xs
  let fxs = 0;
  const gradfxs = new Float64Array(xs0.length);
  const gradientPreconditioned = new Float64Array(gradfxs);
  let normGradfxs = 0;

  const cfg: lbfgs.Config = {
    m: 17,
    armijo: 0.001,
    wolfe: 0.9,
    minInterval: 1e-9,
    maxSteps: 10,
    epsd: 1e-11,
  };

  const state: lbfgs.State =
    lbfgsInfo.lastState !== undefined && lbfgsInfo.lastGrad !== undefined
      ? {
          x: lbfgsInfo.lastState,
          grad: lbfgsInfo.lastGrad,
          s_y: lbfgsInfo.s_list.map((s, i) => ({ s, y: lbfgsInfo.y_list[i] })),
        }
      : lbfgs.firstStep(cfg, (x, grad) => f(x, weight, grad), xs);

  const failed = lbfgs.stepUntil(
    cfg,
    (x, grad) => f(x, weight, grad),
    xs,
    state,
    (info) => {
      if (stop()) return false;

      if (containsNaN(info.state.x)) {
        log.info("xs", xs);
        throw Error("NaN in xs");
      }
      fxs = info.fx;
      gradfxs.set(info.state.grad);
      if (containsNaN(gradfxs)) {
        log.info("gradfxs", gradfxs);
        throw Error("NaN in gradfxs");
      }

      gradientPreconditioned.set(info.r);

      // Don't take the Euclidean norm. According to Boyd (485), we should use the Newton descent check, with the norm of the gradient pulled back to the nicer space.
      normGradfxs = dot(gradfxs, gradientPreconditioned);

      if (BREAK_EARLY && unconstrainedConverged(normGradfxs)) {
        // This is on the original gradient, not the preconditioned one
        log.info("descent converged, stopping early");
        return false;
      }

      const normGrad = normList(gradfxs);

      if (DEBUG_GRAD_DESCENT) {
        log.info("-----");
        log.info("input (xs):", info.state.x);
        log.info("energy (f(xs)):", fxs);
        log.info("grad (grad(f)(xs)):", gradfxs);
        log.info("|grad f(x)|:", normGrad);
        log.info("t", info.t);
      }

      if (Number.isNaN(fxs) || Number.isNaN(normGrad)) {
        log.info("-----");

        const pathMap = zip2(Array.from(info.state.x), Array.from(gradfxs));

        log.info("[current val, gradient of val]", pathMap);

        for (const [x, dx] of pathMap) {
          if (Number.isNaN(dx)) {
            log.info("NaN in varying val's gradient (current val):", x);
          }
        }

        log.info("input (xs):", info.state.x);
        log.info("energy (f(xs)):", fxs);
        log.info("grad (grad(f)(xs)):", gradfxs);
        log.info("|grad f(x)|:", normGrad);
        log.info("t", info.t);
        return true;
      }

      return undefined;
    },
  );

  // TODO: Log stats for last one?

  return {
    xs,
    energyVal: fxs,
    normGrad: normGradfxs,
    newLbfgsInfo: {
      lastState: state.x,
      lastGrad: state.grad,
      s_list: state.s_y.map(({ s }) => s),
      y_list: state.s_y.map(({ y }) => y),
    },
    gradient: gradfxs,
    gradientPreconditioned,
    failed,
  };
};

/**
 * @returns an initial state for optimizing in `n` dimensions
 */
export const start = (n: number): Params => ({
  lastGradient: new Float64Array(n),
  lastGradientPreconditioned: new Float64Array(n),

  weight: initConstraintWeight,
  UOround: 0,
  EPround: 0,
  optStatus: "UnconstrainedRunning",

  lbfgsInfo: defaultLbfgsParams,

  lastUOstate: undefined,
  lastUOenergy: undefined,

  lastEPstate: undefined,
  lastEPenergy: undefined,
});

const containsNaN = (numberList: Float64Array): boolean => {
  for (const n of numberList) {
    if (Number.isNaN(n)) return true;
  }
  return false;
};
