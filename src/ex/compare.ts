import {Num} from "./dag"

type CompareResult = "lt" | "eq" | "gt"
export function compare(left: Num, right: Num): CompareResult {
    return "eq"
}
