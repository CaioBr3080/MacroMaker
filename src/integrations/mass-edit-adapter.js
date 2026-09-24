const MODULE_ID = "multi-token-edit";

function service() {
  const module = globalThis.game?.modules?.get?.(MODULE_ID);
  if (!module?.active) return null;
  return module.api ?? globalThis.MassEdit ?? null;
}

function centerOf(value) {
  if (!value) return null;
  if (Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))) return value;
  if (Number.isFinite(Number(value.center?.x)) && Number.isFinite(Number(value.center?.y))) return value.center;
  return null;
}

function destinationFor(step, context) {
  const configured = context.resolveLocation?.(step.destination ?? "location");
  return centerOf(configured)
    ?? centerOf(context.location)
    ?? centerOf(context.target)
    ?? centerOf(context.source);
}

export class MassEditAdapter {
  static get available() {
    return Boolean(service()?.spawnPreset);
  }

  static async spawnPreset(step, context) {
    const api = service();
    if (!api?.spawnPreset) {
      throw new Error("A etapa Asset exige o módulo Baileywiki Mass Edit ativo.");
    }
    if (!step.presetUuid && !step.presetName) {
      throw new Error("Escolha um preset do Mass Edit para a etapa Asset.");
    }

    const destination = destinationFor(step, context);
    const options = {
      uuid: step.presetUuid || undefined,
      name: step.presetName || undefined,
      preview: step.pickPosition === true,
      snapToGrid: step.snapToGrid !== false,
      hidden: step.hidden === true
    };
    if (step.presetType && step.presetType !== "ALL") options.type = step.presetType;
    if (destination) {
      options.x = Number(destination.x);
      options.y = Number(destination.y);
    }
    return api.spawnPreset(options);
  }
}