function checkNotNaN(num: number): number {
  if (Number.isNaN(num)) throw new Error("Uh oh, NaN-y state")
  return num
}

// Runtime implementation of tracing utils used by our AssemblyScript.
// When `emitJava` is true, the complete logs should be copy/pastable
// to Java, to run the Java LBFGS implementation with the same inputs.
export function traceImpl(emitJava = false) {
  let loss: number
  let grad: number[] = []
  let params: number[] = []

  const log = (what: string, ...rest: any[]) => {
    const prefix = emitJava ? "// " : ""
    console.log(prefix + what, ...rest)
  }

  return {
    traceLoss(val: number): number {
      log("loss", val)
      if (emitJava && loss !== undefined) {
        // Print out the Java code for the *previous* iteration.
        console.log(
          `complete = lb.apply(${loss}, new double[]{ ${grad.join(",")} });`,
        )
      }
      loss = val
      return checkNotNaN(val)
    },
    traceGradient(i: number, val: number): number {
      log("grad ", i, val)
      grad[i] = val
      return checkNotNaN(val)
    },
    traceParam(i: number, val: number): number {
      log("param", i, val)
      params[i] = val
      return checkNotNaN(val)
    },
  }
}
