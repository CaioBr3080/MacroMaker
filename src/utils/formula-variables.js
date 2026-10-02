import { rollFormulaText } from "./roll-formula.js";

// Bare project variable names are aliases for Foundry's @name syntax.
// Formula variables are expanded into the current roll, so their dice are rolled
// together with attack, damage, healing, and generic roll formulas.
export function resolveFormulaVariables(formula, variables = {}) {
  return expandFormula(String(formula ?? ""), variables, new Set());
}

function canInlineFormula(formula, token, offset) {
  const before = formula.slice(0, offset).trim();
  const after = formula.slice(offset + token.length).trim();
  // A whole alias, or an additive term, needs no extra parentheses. Keeping
  // those wrappers hides the primary d20 from systems that inspect terms[0]
  // while rendering chat (e.g. Ordem Paranormal).
  if ((!before || before.endsWith("+")) && (!after || /^[+-]/.test(after))) {
    let depth = 0;
    for (const char of formula.slice(0, offset)) {
      if (char === '"' || char === "'") return false;
      if ("([{".includes(char)) depth++;
      else if (")]}".includes(char)) depth--;
    }
    return depth === 0;
  }
  return false;
}

function expandFormula(formula, variables, stack) {
  return formula.replace(/\[[^\]]*\]|@[A-Za-z_][\w.-]*|[A-Za-z_][A-Za-z0-9_]*/g,
    (token, offset) => {
      if (token.startsWith("[") || /^d\d/i.test(token)) return token;

      const explicit = token.startsWith("@");
      const name = explicit ? token.slice(1) : token;
      // Foundry paths such as @damage.total are runtime data references, not
      // project formula aliases.
      if (name.includes(".") || !Object.hasOwn(variables, name)) return token;
      // Leave Foundry formula functions untouched, e.g. floor(FOR / 2).
      if (!explicit && /^\s*\(/.test(formula.slice(offset + token.length))) return token;

      const value = variables[name];
      const nestedFormula = rollFormulaText(value);
      if (nestedFormula != null) {
        if (stack.has(name)) throw new Error("Referência circular entre fórmulas de variáveis: " + name + ".");
        const nextStack = new Set(stack);
        nextStack.add(name);
        const expanded = expandFormula(nestedFormula, variables, nextStack);
        return canInlineFormula(formula, token, offset) ? expanded : "(" + expanded + ")";
      }
      if (typeof value === "number" && Number.isFinite(value)) return "@" + name;
      throw new Error("A variável " + name + " precisa ser numérica ou uma fórmula de rolagem para usar na fórmula.");
    });
}
