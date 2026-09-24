import { escapeHtml, interpolate, setPath } from "../../utils/safe-values.js";
import { messageStyleCSS } from "../../utils/message-style.js";
import { resolveFormulaVariables } from "../../utils/formula-variables.js";

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

function transformOptionText(value, transform) {
  const text = String(value ?? "");
  if (transform === "upper") return text.toLocaleUpperCase();
  if (transform === "lower") return text.toLocaleLowerCase();
  if (transform === "capitalize") {
    return text.replace(/(^|[\s-])(\p{L})/gu, (_match, prefix, letter) => prefix + letter.toLocaleUpperCase());
  }
  return text;
}

function styledText(tag, className, value, style, variables, extraCSS = "") {
  const text = escapeHtml(interpolate(value ?? "", variables));
  if (!text) return "";
  return "<" + tag + " class=\"" + className + "\" style=\"" + extraCSS + messageStyleCSS(style) + "\">" + text + "</" + tag + ">";
}

async function interpolateOptionDescription(value, variables) {
  const text = interpolate(value, variables);
  const expressions = [...text.matchAll(/\{([^{}]+)\}/g)];
  if (!expressions.length) return escapeHtml(text);

  let result = "";
  let cursor = 0;
  for (const match of expressions) {
    result += text.slice(cursor, match.index);
    const expression = match[1].trim();
    if (!expression) throw new Error("A expressão {} na descrição de uma opção não pode ficar vazia.");
    const RollClass = globalThis.CONFIG?.Dice?.rolls?.[0] ?? globalThis.Roll;
    if (!RollClass) throw new Error("A classe de rolagem do Foundry não está disponível para calcular {" + expression + "}.");
    let roll;
    try {
      roll = await new RollClass(resolveFormulaVariables(expression, variables), variables).evaluate();
    } catch (error) {
      throw new Error("Não foi possível calcular {" + expression + "} na descrição da opção: " + error.message);
    }
    const total = Number(roll?.total);
    if (!Number.isFinite(total)) throw new Error("A expressão {" + expression + "} não produziu um número.");
    result += String(total);
    cursor = match.index + match[0].length;
  }
  return escapeHtml(result + text.slice(cursor));
}

function dialogWidth(columns) {
  const desired = 360 + (columns * 270);
  const viewport = Number(globalThis.window?.innerWidth);
  const maximum = Number.isFinite(viewport) ? Math.max(440, Math.floor(viewport * 0.9)) : 1400;
  return Math.min(maximum, Math.max(560, desired));
}

export class MenuExecutor {
  static async execute(step, context) {
    const columns = Math.min(6, Math.max(1, Number(step.columns ?? 1)));
    const options = await Promise.all((step.options ?? []).map(async (option, index) => {
      const configuredColumn = optionColumn(option.column, columns);
      const effectiveColumn = configuredColumn ?? (index % columns) + 1;
      const textTransform = step.columnSettings?.[effectiveColumn]?.textTransform ?? "none";
      return {
        index,
        value: option.value,
        label: transformOptionText(interpolate(option.label, context.variables, { escape: true }), textTransform),
        description: await interpolateOptionDescription(option.description, context.variables),
        image: escapeHtml(option.image ?? ""),
        icon: escapeHtml(option.icon ?? ""),
        column: configuredColumn
      };
    }));
    if (!options.length) throw new Error("A etapa de menu não possui opções.");

    const columnHeaders = Array.from({ length: columns }, (_value, index) => {
      const number = index + 1;
      const settings = step.columnSettings?.[number] ?? {};
      return {
        number,
        title: settings.title ?? "",
        titleStyle: settings.titleStyle ?? {}
      };
    });
    const columnHeaderMarkup = columnHeaders.some((column) => column.title)
      ? '<div class="macro-maker-menu-column-titles">'
        + columnHeaders.map((column) => styledText("strong", "macro-maker-menu-column-title", column.title, column.titleStyle, context.variables, "grid-column:" + column.number + ";"))
          .join("")
        + "</div>"
      : "";

    const multiple = step.selection === "multiple" || step.multiple === true;
    const defaults = new Set((multiple ? step.defaultValues : [step.defaultValue])
      ?.filter?.((value) => value !== undefined) ?? []);
    if (!multiple && defaults.size === 0) defaults.add(options[0].value);
    const inputType = multiple ? "checkbox" : "radio";
    const gridStyle = "--macro-maker-menu-columns:" + columns + ";--macro-maker-menu-min-width:" + (columns * 250) + "px";
    const title = step.title ?? step.label ?? context.project.name;
    const content = `
      <form class="macro-maker-menu">
        <header class="macro-maker-menu-heading">
          ${styledText("h2", "macro-maker-menu-title", title, step.titleStyle ?? {}, context.variables)}
          ${styledText("p", "macro-maker-menu-description", step.description, step.descriptionStyle ?? {}, context.variables)}
        </header>
        ${step.image ? `<img class="macro-maker-menu-image" src="${escapeHtml(step.image)}" alt="">` : ""}
        <div class="macro-maker-menu-grid-scroll" style="${gridStyle}">
          ${columnHeaderMarkup}
          <div class="macro-maker-menu-options">
            ${options.map((option) => `<label class="macro-maker-menu-card"${option.column ? ` style="grid-column:${option.column}"` : ""}>
              <input type="${inputType}" name="choice" value="${option.index}" ${defaults.has(option.value) ? "checked" : ""}>
              ${option.image ? `<img src="${option.image}" alt="">` : ""}
              <strong>${option.icon ? `<i class="${option.icon}"></i> ` : ""}${option.label}</strong>
              ${option.description ? `<small>${option.description}</small>` : ""}
            </label>`).join("")}
          </div>
        </div>
      </form>`;

    const indexes = await Dialog.wait({
      title: escapeHtml(interpolate(title, context.variables)),
      content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: "Confirmar",
          callback: (html) => selectedIndexes(html?.[0] ?? html)
        }
      },
      close: () => null
    }, {
      width: dialogWidth(columns),
      height: "auto",
      resizable: true
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