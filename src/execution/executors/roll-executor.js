export class RollExecutor {
  static async attack(step, context) {
    const roll = await new Roll(step.formula, context.variables).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ token: context.source?.document }),
      flavor: step.flavor || `${context.project.name} — Ataque`
    });

    const threshold = Number(step.criticalThreshold ?? 20);
    const d20Results = roll.dice
      .filter((term) => term.faces === 20)
      .flatMap((term) => term.results)
      .filter((result) => result.active !== false)
      .map((result) => result.result);

    context.attack = roll;
    context.lastRoll = roll;
    context.critical = d20Results.some((result) => result >= threshold);

    if (step.defense != null) context.hit = roll.total >= Number(step.defense);
    else context.hit = null;
  }

  static async damage(step, context) {
    const formula = context.critical && step.criticalFormula
      ? step.criticalFormula
      : step.formula;
    const roll = await new Roll(formula, context.variables).evaluate();
    context.lastRoll = roll;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ token: context.source?.document }),
      flavor: step.flavor || `${context.project.name} — Dano${context.critical ? " Crítico" : ""}`
    });
  }
}
