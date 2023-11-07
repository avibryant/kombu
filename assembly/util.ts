
@inline
export function getParam(i: u32): f64 {
  // return traceParam(i, load<f64>(i * sizeof<f64>()))
  return load<f64>(i * sizeof<f64>())
}


@inline
export function setParam(i: u32, val: f64): void {
  // store<f64>(i * sizeof<f64>(), traceParam(i, val))
  store<f64>(i * sizeof<f64>(), val)
}


@inline
export function evaluateLoss(): f64 {
  // return traceLoss(call_indirect<f64>(0))
  return call_indirect<f64>(0)
}


@inline
export function evaluateGradient(i: u32): f64 {
  // return traceGradient(i, call_indirect<f64>(i + 1))
  return call_indirect<f64>(i + 1)
}


@inline
export function newStaticArray<T>(len: u32): StaticArray<T> {
  return changetype<StaticArray<T>>(heap.alloc(len << alignof<T>()))
}


@external("env", "traceLoss")
export declare function traceLoss(val: f64): f64


@external("env", "traceGradient")
export declare function traceGradient(i: i32, val: f64): f64


@external("env", "traceParam")
export declare function traceParam(i: i32, val: f64): f64
