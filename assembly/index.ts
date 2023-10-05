export function optimize(numParams: u32, iterations: u32): void {
  const epsilon: f64 = 0.0001
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
