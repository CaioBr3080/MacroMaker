import { RollAnalysis } from "./roll-analysis.js";
import { getPath } from "../utils/safe-values.js";

function compare(actual, operator = "eq", expected) {
  switch (operator) {
    case "eq": return actual === expected || String(actual) === String(expected);
    case "neq": return !(actual === expected || String(actual) === String(expected));
    case "gt": return Number(actual) > Number(expected);
    case "gte": return Number(actual) >= Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "lte": return Number(actual) <= Number(expected);
    case "includes": return Array.isArray(actual)
      ? actual.some((value) => String(value) === String(expected))
      : String(actual ?? "").includes(String(expected));
    default: return false;
  }
}

function result(condition, matched, reason, children = undefined, actual = undefined) {
  return { condition, matched: Boolean(matched), reason, children, actual };
}

function targetFor(condition, context) {
  return context.resolveLocation?.(condition.subject ?? "target")
    ?? (condition.subject === "source" ? context.source : context.target);
}

export class ConditionEngine {
  static async evaluate(condition, context) {
    if (!condition || condition.type === "always") {
      return result(condition ?? { type: "always" }, true, "Condição configurada para sempre executar.");
    }

    if (condition.type === "group") return this.#evaluateGroup(condition, context);

    let actual;
    let matched = false;
    const expected = condition.value;
    const operator = condition.operator ?? "eq";

    switch (condition.type) {
      case "critical": {
        const isCritical = context.critical === true;
        const hasNaturalLimit = condition.value !== undefined && String(condition.value).trim() !== "";
        const values = hasNaturalLimit
          ? RollAnalysis.activeNaturalResults(context.attack ?? context.lastRoll, { faces: condition.faces ?? 20 })
          : null;
        actual = values ?? isCritical;
        matched = hasNaturalLimit
          ? isCritical && values.some((value) => compare(value, operator, expected))
          : isCritical;
        break;
      }
      case "notCritical":
        actual = context.critical === true;
        matched = !actual;
        break;
      case "hit":
        actual = context.hit;
        matched = actual === true;
        break;
      case "miss":
        actual = context.hit;
        matched = actual === false;
        break;
      case "distanceAbove":
        actual = context.distanceTo?.();
        matched = actual != null && compare(actual, "gt", expected);
        break;
      case "distanceAtMost":
        actual = context.distanceTo?.();
        matched = actual != null && compare(actual, "lte", expected);
        break;
      case "distance":
        actual = context.distanceTo?.(targetFor(condition, context));
        matched = actual != null && compare(actual, operator, expected);
        break;
      case "rollValue":
      case "rollTotal":
        actual = context.lastResult?.total ?? context.lastRoll?.total;
        matched = actual != null && compare(actual, operator, expected);
        break;
      case "damage":
      case "damageValue":
        actual = context.damage?.total ?? context.damage?.result?.total;
        matched = actual != null && compare(actual, operator, expected);
        break;
      case "naturalDie": {
        const values = RollAnalysis.activeNaturalResults(context.attack ?? context.lastRoll, { faces: condition.faces ?? 20 });
        actual = values;
        matched = values.some((value) => compare(value, operator, expected));
        break;
      }
      case "targetCount":
        actual = context.targets?.length ?? 0;
        matched = compare(actual, operator, expected);
        break;
      case "variableEquals":
      case "variable":
      case "menuOption":
        actual = getPath(context.variables, condition.key);
        matched = compare(actual, condition.type === "variableEquals" ? "eq" : operator, expected);
        break;
      case "hpPercent":
        actual = await context.systems?.getHpPercent?.(targetFor(condition, context), condition);
        matched = actual != null && compare(actual, operator, expected);
        break;
      case "hasItem":
        actual = await context.systems?.hasItem?.(targetFor(condition, context), condition.value, condition);
        matched = actual === true;
        break;
      case "hasEffect":
        actual = await context.systems?.hasEffect?.(targetFor(condition, context), condition.value, condition);
        matched = actual === true;
        break;
      case "hasTag":
        actual = await context.systems?.hasTag?.(targetFor(condition, context), condition.value, condition);
        matched = actual === true;
        break;
      default:
        return result(condition, false, `Tipo de condição desconhecido: ${condition.type}.`);
    }

    const printable = Array.isArray(actual) ? actual.join(", ") : String(actual ?? "indisponível");
    return result(
      condition,
      matched,
      `${condition.type}: valor ${printable}${expected === undefined ? "" : ` ${operator} ${String(expected)}`} — ${matched ? "passou" : "falhou"}.`,
      undefined,
      actual
    );
  }

  static async #evaluateGroup(condition, context) {
    const operator = String(condition.operator ?? "and").toLowerCase();
    const children = Array.isArray(condition.children) ? condition.children : [];
    const childResults = [];
    for (const child of children) childResults.push(await this.evaluate(child, context));

    let matched;
    if (operator === "or") matched = childResults.some((child) => child.matched);
    else if (operator === "not") matched = childResults.length === 1 && !childResults[0].matched;
    else matched = childResults.length > 0 && childResults.every((child) => child.matched);

    return result(
      condition,
      matched,
      `Grupo ${operator.toUpperCase()} ${matched ? "passou" : "falhou"} (${childResults.filter((child) => child.matched).length}/${childResults.length}).`,
      childResults
    );
  }

  static async matches(condition, context) {
    return (await this.evaluate(condition, context)).matched;
  }

  static async allMatch(conditions = [], context, metadata = {}) {
    const list = Array.isArray(conditions) ? conditions : [];
    const root = list.length === 1 && list[0]?.type === "group"
      ? list[0]
      : { type: "group", operator: "and", children: list.length ? list : [{ type: "always" }] };
    const evaluation = await this.evaluate(root, context);
    context.recordDebug?.({ kind: "condition", ...metadata, evaluation });
    return evaluation.matched;
  }
}
