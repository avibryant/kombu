import {Num} from "./dag"

type CompareResult = "lt" | "eq" | "gt"
export function compare(left: Num, right: Num): CompareResult {
    return "eq"
}

export function equal(left: Num, right: Num ): boolean {
    return compare(left, right) == "eq"
}