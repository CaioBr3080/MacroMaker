const UPDATE_PATHS = [
  "name", "alpha", "hidden", "disposition", "displayName", "displayBars", "width", "height", "rotation", "lockRotation", "movementAction",
  "texture.src", "texture.scaleX", "texture.scaleY", "texture.tint",
  "sight.enabled", "sight.range", "sight.angle", "sight.visionMode", "sight.color", "sight.attenuation", "sight.brightness", "sight.saturation", "sight.contrast",
  "light.dim", "light.bright", "light.angle", "light.color", "light.alpha", "light.coloration", "light.luminosity", "light.attenuation", "light.saturation", "light.contrast", "light.shadows",
  "light.animation.type", "light.animation.speed", "light.animation.intensity", "light.animation.reverse"
];
const NUMERIC_PATHS = new Set([
  "alpha", "disposition", "displayName", "displayBars", "width", "height", "rotation",
  "texture.scaleX", "texture.scaleY", "sight.range", "sight.angle", "sight.attenuation", "sight.brightness", "sight.saturation", "sight.contrast",
  "light.dim", "light.bright", "light.angle", "light.alpha", "light.coloration", "light.luminosity", "light.attenuation", "light.saturation", "light.contrast", "light.shadows",
  "light.animation.speed", "light.animation.intensity"
]);

function readPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function writePath(object, path, value) {
  const keys = path.split(".");
  const key = keys.pop();
  let current = object;
  for (const part of keys) current = current[part] ??= {};
  current[key] = value;
}

function resolveNumeric(value, variables = {}) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  if (text && Number.isFinite(Number(text))) return Number(text);
  const match = /^@?([A-Za-z_][A-Za-z0-9_]*)$/.exec(text);
  if (match) {
    const variable = variables[match[1]];
    if (typeof variable === "number" && Number.isFinite(variable)) return variable;
  }
  throw new Error(`A variável numérica ${text || "informada"} não existe ou não contém um número.`);
}

function updateData(changes, variables = {}) {
  const update = {};
  for (const path of UPDATE_PATHS) {
    const value = readPath(changes, path);
    if (value !== undefined) writePath(update, path, NUMERIC_PATHS.has(path) ? resolveNumeric(value, variables) : value);
  }
  return update;
}

function documentsFor(scope, context) {
  const references = scope === "source"
    ? [context.source]
    : scope === "targets"
      ? context.targets
      : [context.target];
  const documents = references
    .map((placeable) => placeable?.document ?? placeable)
    .filter((document) => document && typeof document.update === "function");
  return [...new Map(documents.map((document) => [document.uuid ?? document.id, document])).values()];
}

export class TokenUpdateExecutor {
  static async execute(step, context) {
    const documents = documentsFor(step.scope ?? "target", context);
    if (!documents.length) throw new Error("A etapa Modificar token não encontrou tokens no escopo escolhido.");
    const update = updateData(step.changes ?? {}, context.variables ?? {});
    if (!Object.keys(update).length) throw new Error("Configure ao menos uma alteração para o token da cena.");
    return Promise.all(documents.map((document) => document.update(update)));
  }
}