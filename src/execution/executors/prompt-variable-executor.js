import { clone, getPath, interpolate, setPath, escapeHtml } from "../../utils/safe-values.js";
import { rollFormulaText } from "../../utils/roll-formula.js";
import { typedValue } from "./variable-executor.js";
import { ProjectRepository } from "../../services/project-repository.js";

function displayValue(value) {
  const formula = rollFormulaText(value);
  if (formula !== null) return formula;
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function responseValue(root) {
  if (root?.querySelector) return root.querySelector("[name='macro-maker-prompt-value']")?.value;
  return root?.find?.("[name='macro-maker-prompt-value']")?.val?.();
}

export class PromptVariableExecutor {
  static async execute(step, context) {
    const variable = step.variable;
    const permanent = step.saveMode === "permanent";
    if (permanent && !context.macro?.isOwner) {
      throw new Error("Salvar uma resposta permanentemente exige permissão para editar este macro.");
    }

    const current = getPath(context.variables, variable);
    const title = interpolate(step.title ?? step.label ?? "Informar valor", context.variables);
    const description = interpolate(step.description ?? "", context.variables);
    const type = step.valueType ?? "string";
    const defaultValue = displayValue(current);
    const input = type === "boolean"
      ? `<select name="macro-maker-prompt-value"><option value="true" ${current === true ? "selected" : ""}>Verdadeiro</option><option value="false" ${current !== true ? "selected" : ""}>Falso</option></select>`
      : `<input type="text" name="macro-maker-prompt-value" value="${escapeHtml(defaultValue)}" ${type === "number" ? 'inputmode="decimal"' : ""} autofocus>`;
    const typeLabel = {
      auto: "Automático",
      string: "Texto",
      number: "Número",
      boolean: "Booleano",
      array: "Lista",
      formula: "Fórmula de rolagem"
    }[type] ?? type;
    const content = `<form class="macro-maker-variable-prompt"><p>${escapeHtml(description)}</p><label>${escapeHtml(step.inputLabel ?? variable)} <small>${escapeHtml(typeLabel)}</small>${input}</label></form>`;
    const rawValue = await Dialog.wait({
      title: escapeHtml(title),
      content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: "Confirmar",
          callback: (html) => responseValue(html?.[0] ?? html)
        }
      },
      close: () => null
    });

    if (rawValue == null) {
      const behavior = step.cancelBehavior ?? "abort";
      if (behavior === "abort") context.cancelled = true;
      context.recordDebug?.({ kind: "promptVariable", stepId: step.id, variable, cancelled: true, behavior });
      return null;
    }

    const value = typedValue(rawValue, type);
    setPath(context.variables, variable, value);
    if (permanent) {
      setPath(context.project.variables, variable, clone(value));
      await ProjectRepository.update(context.macro, context.project);
    }
    context.recordDebug?.({ kind: "promptVariable", stepId: step.id, variable, value, permanent });
    return value;
  }
}