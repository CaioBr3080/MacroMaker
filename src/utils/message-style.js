import { escapeHtml, interpolate, interpolateFormula } from "./safe-values.js";

export const MESSAGE_FONTS = {
  inherit: "Padrão", Arial: "Arial", Georgia: "Georgia", Verdana: "Verdana",
  "Courier New": "Courier New", "Times New Roman": "Times New Roman"
};

export function messageStyleCSS(style = {}) {
  style ??= {};
  const rules = ["white-space:pre-wrap"];
  if (Object.hasOwn(MESSAGE_FONTS, style.font)) rules.push(`font-family:${style.font}`);
  const size = Number(style.size);
  if (Number.isFinite(size) && size >= 8 && size <= 72) rules.push(`font-size:${size}px`);
  if (/^#[0-9a-f]{6}$/i.test(style.color)) rules.push(`color:${style.color}`);
  if (style.bold === true) rules.push("font-weight:bold");
  if (style.italic === true) rules.push("font-style:italic");
  if (style.underline === true) rules.push("text-decoration:underline");
  if (["left", "center", "right"].includes(style.align)) rules.push(`text-align:${style.align}`);
  return rules.join(";");
}

function formattedFlavor(step, text) {
  const hasStyle = step.messageStyle && Object.keys(step.messageStyle).length > 0;
  // Preserve legacy HTML when neither custom formatting nor whitespace handling is needed.
  if (!hasStyle && !/[\n\r]| {2,}|\t|^\s|\s$/.test(text)) return text;
  const content = hasStyle ? escapeHtml(text) : text;
  return `<div style="${messageStyleCSS(step.messageStyle ?? {})}">${content}</div>`;
}

export function messageFlavor(step, fallback, variables = {}) {
  return formattedFlavor(step, interpolate(step.flavor || fallback, variables));
}

export async function messageFlavorFormula(step, fallback, variables = {}) {
  return formattedFlavor(step, await interpolateFormula(step.flavor || fallback, variables));
}

export function speakerConfig(step, variables = {}) {
  const style = step.speakerStyle ?? {};
  return {
    append: interpolate(step.speakerAppend ?? "", variables),
    css: messageStyleCSS(style)
  };
}

export async function speakerConfigFormula(step, variables = {}) {
  const style = step.speakerStyle ?? {};
  return {
    append: await interpolateFormula(step.speakerAppend ?? "", variables),
    css: messageStyleCSS(style)
  };
}
