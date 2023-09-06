export interface Bounds {
    lower: number
    upper: number
}

export function constantBounds(n: number) {
    return { lower: n, upper: n }
}

export const NonNegativeBounds = { lower: 0, upper: Infinity }

export const Unbounded = { lower: -Infinity, upper: Infinity }

export function add(a: Bounds, b: Bounds): Bounds {
    return {
        lower: a.lower + b.lower,
        upper: a.upper + b.upper
    }
}

  //we want, eg, 0*inf = inf here, to capture the limit as right->inf,
  //since the limit as left->0 will be captured by the other bound
function multiply(left: number, right: number): number {
    if (left == Infinity && right == 0.0)
      return left
    else if (left == 0.0 && right == Infinity)
      return right
    else
      return left * right
}


export function mul(a: Bounds, b: Bounds): Bounds {
    const options =
     [multiply(a.lower, b.lower),
      multiply(a.lower, b.upper),
      multiply(a.upper, b.lower),
      multiply(a.upper, b.upper)]

    return {
        lower: Math.min(...options),
        upper: Math.max(...options)
    }
}

function or(a: Bounds, b: Bounds): Bounds {
    return {
        lower: Math.min(a.lower, b.lower),
        upper: Math.max(a.upper, b.upper)
    }
}

function reciprocal(x: Bounds): Bounds {
    if (x.lower <= 0.0 && x.upper >= 0.0)
    return Unbounded
    else
    return {
        lower: 1.0 / x.upper,
        upper: 1.0 / x.lower
    }
}

function positivePow(x: Bounds, y: Bounds): Bounds {
    if (x.lower >= 0.0)
      return positivePositivePow(x, y)
    else if (x.upper <= 0.0)
      return negativePositivePow(x, y)
    else
      return or(
          negativePositivePow({lower: x.lower, upper: 0.0}, y),
          positivePositivePow({lower: 0.0, upper: x.upper}, y)
        )
}

function negativePow(x: Bounds, y: Bounds): Bounds {
    return reciprocal(positivePow(x, {lower: y.lower * -1, upper: y.upper * -1}))
}

function negativePositivePow(x: Bounds, y: Bounds): Bounds {
    if (y.lower == y.upper && Number.isInteger(y.lower)) {
        const a = Math.pow(x.lower, y.lower)
        const b = Math.pow(x.upper, y.lower)
        return {
            lower: Math.min(a,b), upper: Math.max(a,b)
        }
      } else
        return Unbounded
}


function positivePositivePow(x: Bounds, y: Bounds): Bounds {
    const options = [
        Math.pow(x.lower, y.lower),
        Math.pow(x.lower, y.upper),
        Math.pow(x.upper, y.lower),
        Math.pow(x.upper, y.upper)
    ]

    return {
        lower: Math.min(...options),
        upper: Math.max(...options)
    }
}


export function pow(x: Bounds, y: Bounds): Bounds {
    if(y.lower >= 0.0)
        return positivePow(x, y)
    else if(y.upper <= 0.0)
        return negativePow(x, y)
    else
        return or(
            negativePow(x, {lower: y.lower, upper: 0.0}),
            positivePow(x, {lower: 0.0, upper: y.upper}))
}

export function abs(x: Bounds): Bounds {
    if (x.lower <= 0.0 && x.upper >= 0.0)
        return {lower: 0, upper: Math.max(Math.abs(x.lower), x.upper)}
    else {
        const a = Math.abs(x.lower)
        const b = Math.abs(x.upper)
        return {lower: Math.min(a,b), upper: Math.max(a,b)}
    }
}