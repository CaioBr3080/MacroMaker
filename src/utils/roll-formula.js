const ROLL_FORMULA_KEY = "__macroMakerRollFormula";

export function createRollFormulaVariable(formula) {
  const value = String(formula ?? "");
  if (!value.trim()) throw new Error("A fórmula da variável não pode ficar vazia.");
  return { [ROLL_FORMULA_KEY]: value };
}

export function rollFormulaText(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const formula = value[ROLL_FORMULA_KEY];
  return typeof formula === "string" && Object.keys(value).length === 1 ? formula : null;
}