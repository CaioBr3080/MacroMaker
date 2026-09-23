export class RollAnalysis {
  static activeNaturalResults(roll, { faces = 20 } = {}) {
    return (roll?.dice ?? [])
      .filter((term) => Number(term.faces) === Number(faces))
      .flatMap((term) => term.results ?? [])
      .filter((result) => result.active !== false)
      .map((result) => Number(result.result))
      .filter(Number.isFinite);
  }

  static isCritical(roll, step = {}, { defense = null } = {}) {
    const config = step.critical ?? {};
    const threshold = Number(config.threshold ?? step.criticalThreshold ?? 20);
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
