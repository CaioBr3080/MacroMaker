import { ConditionEngine } from "./condition-engine.js";

export class StepRunner {
  static async run(steps, context, stepRegistry, { events = null, event = null } = {}) {
    if (!stepRegistry) throw new Error("O registro de etapas não está disponível.");
    for (const [index, step] of steps.entries()) {
      if (step.enabled === false) continue;
      if (event ? step.event !== event : Boolean(step.event)) continue;
      if (!ConditionEngine.allMatch(step.conditions, context)) continue;
      try {
        await stepRegistry.execute(step, context);
        if (events) await events.afterStep(step);
      } catch (error) {
        const label = step.label || step.type || "sem nome";
        throw new Error(`Falha na etapa ${index + 1} (${label}): ${error.message}`, { cause: error });
      }
    }
  }
}
