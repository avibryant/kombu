import * as t from "./types"

export function collectParams(root: t.Num): t.Param[] {
  const params = new Set<t.Param>()
  const visited = new Set<t.Num>()

  function visitNum(num: t.Num) {
    if (!visited.has(num)) {
      visited.add(num)

      switch (num.type) {
        case t.NumType.Constant:
          break
        case t.NumType.Param:
          params.add(num)
          break
        case t.NumType.Sum:
          visitSum(num.firstTerm)
          break
        case t.NumType.Product:
          visitProduct(num.firstTerm)
          break
        case t.NumType.Unary:
          visitNum(num.term)
          break
      }
    }
  }

  function visitSum(node: t.TermNode<t.SumTerm>) {
    visitNum(node.x)
    if (node.nextTerm) visitSum(node.nextTerm)
  }

  function visitProduct(node: t.TermNode<t.ProductTerm>) {
    visitNum(node.x)
    if (node.nextTerm) visitProduct(node.nextTerm)
  }

  visitNum(root)

  return Array.from(params)
}
