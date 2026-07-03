/**
 * Tiny arithmetic evaluator for numeric fields (Figma-style math: "100+24", "/2" is not
 * supported — the expression must be complete). Supports + - * / ( ) and unary minus.
 * Extension pages run under MV3 CSP (no eval/new Function), hence a hand-rolled parser.
 * Returns null when the input isn't a valid arithmetic expression.
 */
export function evaluateExpression(input: string): number | null {
  const src = input.replace(/\s+/g, "");
  if (!src || !/^[\d+\-*/().]+$/.test(src)) return null;

  let pos = 0;

  const parseExpr = (): number => {
    let v = parseTerm();
    while (src[pos] === "+" || src[pos] === "-") {
      const op = src[pos++];
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  };

  const parseTerm = (): number => {
    let v = parseFactor();
    while (src[pos] === "*" || src[pos] === "/") {
      const op = src[pos++];
      const rhs = parseFactor();
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  };

  const parseFactor = (): number => {
    if (src[pos] === "-") {
      pos++;
      return -parseFactor();
    }
    if (src[pos] === "+") {
      pos++;
      return parseFactor();
    }
    if (src[pos] === "(") {
      pos++;
      const v = parseExpr();
      if (src[pos] !== ")") throw new Error("unbalanced parens");
      pos++;
      return v;
    }
    const m = /^\d*\.?\d+/.exec(src.slice(pos));
    if (!m) throw new Error("expected number");
    pos += m[0].length;
    return parseFloat(m[0]);
  };

  try {
    const result = parseExpr();
    if (pos !== src.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
