function numericCriticalSetting(value, variables, { fallback, minimum, label }) {
  let resolved = value ?? fallback;
  if (typeof resolved === "string") {
    const text = resolved.trim();
    const reference = text.match(/^@?([A-Za-z_][A-Za-z0-9_]*)$/);
    if (reference && Object.hasOwn(variables ?? {}, reference[1])) resolved = variables[reference[1]];
    else resolved = text;
  }
  const number = Number(resolved);
  if (!Number.isFinite(number) || number < minimum) {
    throw new Error(label + " precisa ser um número válido ou uma variável numérica.");
  }
  return number;
}
export class RollAnalysis {
  static activeNaturalResults(roll, { faces = 20 } = {}) {
    return (roll?.dice ?? [])
      .filter((term) => Number(term.faces) === Number(faces))
      .flatMap((term) => term.results ?? [])
      .filter((result) => result.active !== false)
      .map((result) => Number(result.result))
      .filter(Number.isFinite);
  }

  static isCritical(roll, step = {}, { defense = null, variables = {} } = {}) {
    const config = step.critical ?? {};
    const threshold = numericCriticalSetting(config.threshold ?? step.criticalThreshold, variables, { fallback: 20, minimum: 1, label: "O limiar crítico" });
    const faces = Number(config.faces ?? 20);
    const operator = config.operator ?? "gte";
    const naturalCritical = this.activeNaturalResults(roll, { faces }).some((result) => {
      if (operator === "eq") return result === threshold;
      if (operator === "lte") return result <= threshold;
      return result >= threshold;
    });
    const margin = Number(config.margin ?? step.criticalMargin);
    const marginCritical = Number.isFinite(margin)
      && Number.isFinite(Number(defense))
      && Number(roll?.total) - Number(defense) >= margin;
    return naturalCritical || marginCritical;
  }

  static criticalFormula(step, formula) {
    if (step.criticalFormula) return step.criticalFormula;
    const multiplier = Number(step.criticalMultiplier ?? step.critical?.multiplier);
    if (Number.isFinite(multiplier) && multiplier > 0 && multiplier !== 1) {
      return `(${formula}) * ${multiplier}`;
    }
    return formula;
  }
}
