
@inline
export function getParam(i: u32): f64 {
  return load<f64>(i * 16) // Get param_i
}


@inline
export function setParam(i: u32, val: f64): void {
  store<f64>(i * 16, val) // Set param_i
}


@inline
export function evaluateLoss(): f64 {
  return call_indirect<f64>(0)
}


@inline
export function evaluateGradient(i: u32): f64 {
  return call_indirect<f64>(i + 1)
}


@inline
export function newStaticArray<T>(len: u32): StaticArray<T> {
  return changetype<StaticArray<T>>(heap.alloc(len << alignof<T>()))
}
