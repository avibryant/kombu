/*
  A naive optimization function.

  The code relies on the following assumptions:
  - The module contains a table, with numParams + 1 functions: the loss
    function (at index 0) followed by the components of the gradient.
  - The functions in the table all have signature () => f64.
  - That signature must have typeidx 0 in the final module. (TODO: investigate
    why this is assumed by AssemblyScript and if there's a way to change it.)
  - The params are f64s stored contingously at the beginning of memory 0.
 */
export function optimize(numParams: u32, iterations: u32, epsilon: f64): void {
  let i = iterations
  while (i > 0) {
    call_indirect<f64>(0) // Evaluate loss
    for (let i: u32 = 0; i < numParams; ++i) {
      const diff: f64 = call_indirect(i + 1) // Evaluate gradient
      const old = load<f64>(i * 8) // Get param_i
      const update = old - diff * epsilon
      store<f64>(i * 8, update) // Set param_i
    }
    i = i - 1
  }
}
