import { ConditionEngine } from "./condition-engine.js";

export class StepRunner {
  static async run(steps, context, stepRegistry, { events = null, event = null } = {}) {
    if (!stepRegistry) throw new Error("O registro de etapas não está disponível.");
    if (!Array.isArray(steps)) throw new Error("A lista de etapas é inválida.");
    let index = 0;
    let iterations = 0;
    while (index < steps.length) {
      if (++iterations > 1000) throw new Error("Execução interrompida: limite de 1000 etapas excedido.");
      const step = steps[index];
      if (step.enabled === false) {
        index += 1;
        continue;
      }
      if (event ? step.event !== event : Boolean(step.event)) {
        index += 1;
        continue;
      }
      if (!await ConditionEngine.allMatch(step.conditions, context, {
        stepId: step.id,
        stepLabel: step.label,
        stepType: step.type
      })) {
        index += 1;
        continue;
      }
      try {
        context.currentStep = step;
        await stepRegistry.execute(step, context);
        if (events) await events.afterStep(step);
      } catch (error) {
        const label = step.label || step.type || "sem nome";
        throw new Error(`Falha na etapa ${index + 1} (${label}): ${error.message}`, { cause: error });
      }
      if (context.cancelled) break;
      const currentIndex = steps.indexOf(step);
      index = currentIndex >= 0 ? currentIndex + 1 : index;
    }
  }
}
