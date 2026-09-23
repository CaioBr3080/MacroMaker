import { escapeHtml, interpolate } from "./safe-values.js";

export const MESSAGE_FONTS = {
  inherit: "Padrão", Arial: "Arial", Georgia: "Georgia", Verdana: "Verdana",
  "Courier New": "Courier New", "Times New Roman": "Times New Roman"
};

export function messageStyleCSS(style = {}) {
  style ??= {};
  const rules = [];
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

export function messageFlavor(step, fallback, variables = {}) {
  const text = interpolate(step.flavor || fallback, variables);
  // Existing HTML flavors remain compatible until formatting is explicitly used.
  if (!step.messageStyle) return text;
  return `<div style="${messageStyleCSS(step.messageStyle)}">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
}
