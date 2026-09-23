import { escapeHtml, interpolate, setPath } from "../../utils/safe-values.js";

function selectedIndexes(root) {
  if (root?.querySelectorAll) {
    return [...root.querySelectorAll('[name="choice"]:checked')].map((input) => Number(input.value));
  }
  const value = root?.find?.('[name="choice"]:checked')?.map?.((_index, input) => input.value)?.get?.() ?? [];
  return value.map(Number);
}

function optionColumn(value, columns) {
  const column = Number(value);
  return Number.isInteger(column) && column >= 1 && column <= columns ? column : null;
}

export class MenuExecutor {
  static async execute(step, context) {
    const columns = Math.min(6, Math.max(1, Number(step.columns ?? 1)));
    const options = (step.options ?? []).map((option, index) => ({
      index,
      value: option.value,
      label: interpolate(option.label, context.variables, { escape: true }),
      description: interpolate(option.description, context.variables, { escape: true }),
      image: escapeHtml(option.image ?? ""),
      icon: escapeHtml(option.icon ?? ""),
      column: optionColumn(option.column, columns)
    }));
    if (!options.length) throw new Error("A etapa de menu não possui opções.");

    const multiple = step.selection === "multiple" || step.multiple === true;
    const defaults = new Set((multiple ? step.defaultValues : [step.defaultValue])
      ?.filter?.((value) => value !== undefined) ?? []);
    if (!multiple && defaults.size === 0) defaults.add(options[0].value);
    const inputType = multiple ? "checkbox" : "radio";
    const content = `
      <form class="macro-maker-menu">
        ${step.description ? `<p>${interpolate(step.description, context.variables, { escape: true })}</p>` : ""}
        ${step.image ? `<img class="macro-maker-menu-image" src="${escapeHtml(step.image)}" alt="">` : ""}
        <div class="macro-maker-menu-options" style="--macro-maker-menu-columns:${columns}">
          ${options.map((option) => `<label class="macro-maker-menu-card"${option.column ? ` style="grid-column:${option.column}"` : ""}>
            <input type="${inputType}" name="choice" value="${option.index}" ${defaults.has(option.value) ? "checked" : ""}>
            ${option.image ? `<img src="${option.image}" alt="">` : ""}
            <strong>${option.icon ? `<i class="${option.icon}"></i> ` : ""}${option.label}</strong>
            ${option.description ? `<small>${option.description}</small>` : ""}
          </label>`).join("")}
        </div>
      </form>`;

    const indexes = await Dialog.wait({
      title: escapeHtml(interpolate(step.title ?? step.label ?? context.project.name, context.variables)),
      content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: "Confirmar",
          callback: (html) => selectedIndexes(html?.[0] ?? html)
        }
      },
      close: () => null
    });

    let value;
    if (indexes == null) {
      const behavior = step.cancelBehavior ?? (step.cancelStops === false ? "continue" : "abort");
      if (behavior === "abort") {
        context.cancelled = true;
        context.recordDebug?.({ kind: "menu", stepId: step.id, cancelled: true, behavior });
        return null;
      }
      if (behavior === "default") value = multiple ? [...defaults] : [...defaults][0];
      else return null;
    } else {
      const selected = indexes.map((index) => options[index]?.value).filter((item) => item !== undefined);
      if (!multiple && selected.length === 0) throw new Error("Selecione uma opção.");
      value = multiple ? selected : selected[0];
    }
    setPath(context.variables, step.variable ?? "choice", value);
    context.recordDebug?.({ kind: "menu", stepId: step.id, variable: step.variable ?? "choice", value });
    return value;
  }
}
