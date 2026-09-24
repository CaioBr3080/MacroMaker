import { clone, getPath, interpolateFormula, setPath } from "../../utils/safe-values.js";
import { createRollFormulaVariable } from "../../utils/roll-formula.js";

export function typedValue(value, type = "auto") {
  if (type === "string") return String(value ?? "");
  if (type === "formula") return createRollFormulaVariable(value);
  if (type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("O valor da variável precisa ser numérico.");
    return number;
  }
  if (type === "boolean") return value === true || value === "true" || value === 1 || value === "1";
  if (type === "array") return Array.isArray(value) ? clone(value) : [value];
  return clone(value);
}

export class VariableExecutor {
  static async execute(step, context) {
    const current = getPath(context.variables, step.variable);
    const rawValue = typeof step.value === "string" ? await interpolateFormula(step.value, context.variables) : step.value;
    const value = typedValue(rawValue, step.valueType ?? "auto");
    let next;
    switch (step.operation ?? "set") {
      case "add": next = Number(current ?? 0) + Number(value); break;
      case "subtract": next = Number(current ?? 0) - Number(value); break;
      case "multiply": next = Number(current ?? 0) * Number(value); break;
      case "append": next = [...(Array.isArray(current) ? current : []), ...(Array.isArray(value) ? value : [value])]; break;
      case "toggle": next = !Boolean(current); break;
      case "set": next = value; break;
      default: throw new Error(`Transformação de variável desconhecida: ${step.operation}.`);
    }
    if (["add", "subtract", "multiply"].includes(step.operation) && !Number.isFinite(next)) {
      throw new Error("A transformação de variável produziu um número inválido.");
    }
    setPath(context.variables, step.variable, next);
    context.recordDebug?.({ kind: "variable", variable: step.variable, operation: step.operation ?? "set", value: next });
    return next;
  }
}
