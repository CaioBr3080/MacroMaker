// Bare project variable names are aliases for Foundry's @name syntax.
// Preserve dice notation, explicit references, flavor annotations and functions.
export function resolveFormulaVariables(formula, variables = {}) {
  return formula.replace(/\[[^\]]*\]|@[A-Za-z_][\w.-]*|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?/g,
    (token, offset) => {
      if (token.startsWith("[") || token.startsWith("@") || /^\d|^d\d/i.test(token)) return token;
      if (!Object.hasOwn(variables, token) || /^\s*\(/.test(formula.slice(offset + token.length))) return token;
      if (typeof variables[token] !== "number" || !Number.isFinite(variables[token])) {
        throw new Error(`A variável ${token} precisa ser numérica para usar na fórmula.`);
      }
      return `@${token}`;
    });
}
