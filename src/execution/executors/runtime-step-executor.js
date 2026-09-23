import { createId } from "../../utils/ids.js";
import { clone } from "../../utils/safe-values.js";

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor", "id"]);

function merge(target, changes) {
  for (const [key, value] of Object.entries(changes ?? {})) {
    if (UNSAFE_KEYS.has(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] = target[key] && typeof target[key] === "object" && !Array.isArray(target[key]) ? target[key] : {};
      merge(target[key], value);
    } else target[key] = clone(value);
  }
  return target;
}

export class RuntimeStepExecutor {
  static async execute(step, context) {
    const steps = context.runtimeSteps;
    if (!Array.isArray(steps)) throw new Error("As etapas de execução não estão disponíveis.");
    const targetId = step.targetId ?? context.currentStep?.id;
    const index = steps.findIndex((candidate) => candidate.id === targetId);
    const action = step.action ?? "modify";

    if (action === "add") {
      const addition = clone(step.step);
      if (!addition?.type || !context.stepRegistry?.has(addition.type)) {
        throw new Error("A etapa adicionada possui um tipo desconhecido.");
      }
      addition.id = createId("step");
      const insertion = index >= 0 ? index + (step.position === "before" ? 0 : 1) : steps.length;
      steps.splice(insertion, 0, addition);
      return context.recordDebug?.({ kind: "runtime-mutation", action, targetId, stepId: addition.id });
    }

    if (index < 0) throw new Error(`Etapa alvo não encontrada: ${targetId}.`);
    if (steps[index] === context.currentStep) throw new Error("Uma alteração condicional não pode substituir ou remover a si mesma.");

    if (action === "remove") steps.splice(index, 1);
    else if (action === "replace") {
      const replacement = clone(step.step);
      if (!replacement?.type || !context.stepRegistry?.has(replacement.type)) {
        throw new Error("A etapa substituta possui um tipo desconhecido.");
      }
      replacement.id = targetId;
      steps[index] = replacement;
    } else if (action === "modify") merge(steps[index], step.changes);
    else throw new Error(`Ação condicional desconhecida: ${action}.`);

    return context.recordDebug?.({ kind: "runtime-mutation", action, targetId });
  }
}
