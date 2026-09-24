import { rollFormulaText } from "./roll-formula.js";
import { resolveFormulaVariables } from "./formula-variables.js";
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function safePath(path) {
  if (typeof path !== "string" || !VARIABLE_NAME_PATTERN.test(path)) return null;
  const parts = path.split(".");
  return parts.some((part) => UNSAFE_KEYS.has(part)) ? null : parts;
}

export function getPath(object, path, fallback = undefined) {
  const parts = Array.isArray(path) ? path : safePath(path);
  if (!parts) return fallback;
  let current = object;
  for (const part of parts) {
    if (current == null || !Object.prototype.hasOwnProperty.call(Object(current), part)) return fallback;
    current = current[part];
  }
  return current;
}

export function setPath(object, path, value) {
  const parts = safePath(path);
  if (!parts) throw new Error(`Nome de variável inválido: ${path}.`);
  const last = parts.pop();
  let current = object;
  for (const part of parts) {
    const next = current[part];
    current[part] = next && typeof next === "object" && !Array.isArray(next) ? next : {};
    current = current[part];
  }
  current[last] = value;
  return value;
}

export function escapeHtml(value) {
  const foundryEscape = globalThis.foundry?.utils?.escapeHTML;
  if (foundryEscape) return foundryEscape(String(value ?? ""));
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

export function interpolate(value, variables, { escape = false } = {}) {
  const resolve = (_match, path) => {
    const resolved = getPath(variables, path, "");
    const formula = rollFormulaText(resolved);
    return formula ?? (resolved == null ? "" : String(resolved));
  };
  const output = String(value ?? "")
    .replace(/\{\{\s*variables\.([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g, resolve)
    .replace(/\{\s*@?([A-Za-z_][A-Za-z0-9_.-]*)\s*\}/g, resolve);
  return escape ? escapeHtml(output) : output;
}

/** Resolve referências curtas e fórmulas entre chaves pelo Roll do Foundry. */
export async function interpolateFormula(value, variables = {}, { escape = false } = {}) {
  const text = interpolate(value, variables);
  const expressions = [...text.matchAll(/\{([^{}]+)\}/g)];
  if (!expressions.length) return escape ? escapeHtml(text) : text;

  const RollClass = globalThis.CONFIG?.Dice?.rolls?.[0] ?? globalThis.Roll;
  if (!RollClass) throw new Error("A classe de rolagem do Foundry não está disponível para calcular texto com fórmulas.");

  let output = "";
  let cursor = 0;
  for (const match of expressions) {
    output += text.slice(cursor, match.index);
    const expression = match[1].trim();
    if (!expression) throw new Error("A expressão {} não pode ficar vazia.");
    try {
      const formula = resolveFormulaVariables(expression, variables);
      const roll = await new RollClass(formula, variables).evaluate();
      const total = Number(roll?.total);
      if (!Number.isFinite(total)) throw new Error("não produziu um número");
      output += String(total);
    } catch (error) {
      throw new Error("Não foi possível calcular {" + expression + "}: " + error.message);
    }
    cursor = match.index + match[0].length;
  }
  output += text.slice(cursor);
  return escape ? escapeHtml(output) : output;
}
