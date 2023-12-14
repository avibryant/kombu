export interface LBFGSOptions {
  method: "LBFGS"
  epsilon: number
  m: number
}

export interface GradientDescentOptions {
  method: "GradientDescent"
  learningRate: number
}

export type OptimizeOptions = LBFGSOptions | GradientDescentOptions

export function makeDefaults(): {
  LBFGS: LBFGSOptions
  GradientDescent: GradientDescentOptions
} {
  return {
    LBFGS: {
      method: "LBFGS",
      epsilon: 0.1,
      m: 5,
    },
    GradientDescent: {
      method: "GradientDescent",
      learningRate: 0.1,
    },
  }
}

export const defaultOptions: OptimizeOptions = makeDefaults().LBFGS
