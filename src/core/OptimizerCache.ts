import * as t from "./types"

// For each parameter, we reserve multiple f64 slots.
// The first slot holds the parameter value itself. Currently the second
// slot is used to hold the moving average the gradient.
const paramSizeSlots = 2

export class OptimizerCache {
  memory: WebAssembly.Memory
  cache: Float64Array

  constructor(size: number) {
    this.memory = new WebAssembly.Memory({ initial: size })
    this.cache = new Float64Array(this.memory.buffer)
  }

  getParam(idx: number): number {
    return this.cache[idx * paramSizeSlots]
  }

  setParam(idx: number, val: number): void {
    this.cache[idx * paramSizeSlots] = val
  }

  setParams(entries: [t.Param, number][]): void {
    entries.forEach(([_, val], i) => {
      this.setParam(i, val)
    })
  }
}
