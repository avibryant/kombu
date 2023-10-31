import { optimize } from "./lbfgs"
import { getParam, setParam, evaluateLoss, evaluateGradient } from "./util"


@final @unmanaged
class Test {
  private nums: StaticArray<i32>

  constructor(count: i32) {
    this.nums = changetype<StaticArray<i32>>(
      heap.alloc(count << alignof<i32>()),
    )
    for (let i = 0; i < count; i++) {
      this.nums[i] = i
    }
  }

  sum(): i32 {
    let ans: i32 = 0
    for (let i = 0; i < this.nums.length; i++) {
      ans += this.nums[i]
    }
    return ans
  }

  destroy(): void {
    heap.free(changetype<i32>(this.nums))
  }
}

export function staticSum(): i32 {
  const t = new Test(5)
  const ans = t.sum()
  t.destroy()
  heap.free(changetype<i32>(t))
  return ans
}

/*
  Based on an example Tensorflow implementation of RMSProp from "Dive into
  Deep Learning".

  Source: https://d2l.ai/chapter_optimization/rmsprop.html

  def rmsprop(params, grads, states, hyperparams):
      gamma, eps = hyperparams['gamma'], 1e-6
      for p, s, g in zip(params, states, grads):
          s[:].assign(gamma * s + (1 - gamma) * tf.math.square(g))
          p[:].assign(p - hyperparams['lr'] * g / tf.math.sqrt(s + eps))

Good defaults:
- learningRate = 0.001
- epsilon = 1e-6
- gamma = 0.9 - 0.99
*/
// export function optimize(
//   numFreeParams: u32,
//   iterations: u32,
//   learningRate: f64,
//   epsilon: f64,
//   gamma: f64,
// ): void {
//   let i = iterations
//   while (i > 0) {
//     evaluateLoss()
//     for (let i: u32 = 0; i < numFreeParams; ++i) {
//       const g = evaluateGradient(i)
//       const s = getState(i)

//       // Update the cache with the decayed moving average of squared gradients.
//       const newS = gamma * s + (1 - gamma) * g * g
//       setState(i, newS)

//       // Update the parameter value.
//       const p = getParam(i)
//       setParam(i, p - (learningRate * g) / Math.sqrt(newS + epsilon))
//     }
//     i = i - 1
//   }
// }
export { optimize } from './lbfgs'

@inline
function getState(i: u32): f64 {
  return load<f64>(i * 16 + 8)
}


@inline
function setState(i: u32, val: f64): void {
  store<f64>(i * 16 + 8, val)
}
