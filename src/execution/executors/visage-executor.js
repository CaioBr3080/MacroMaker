function visageApi() {
  const module = globalThis.game?.modules?.get?.("visage");
  return module?.active ? module.api ?? null : null;
}

function runtimeTargets(scope, context) {
  const values = scope === "source"
    ? [context.source]
    : scope === "targets"
      ? context.targets
      : [context.target];
  return values.filter(Boolean);
}

async function localTarget(uuid) {
  if (!uuid) throw new Error("Escolha o token da cena para usar um Visage local.");
  if (typeof globalThis.fromUuid !== "function") throw new Error("O resolvedor de UUID do Foundry não está disponível.");
  const document = await globalThis.fromUuid(uuid);
  if (!document) throw new Error("O token configurado para o Visage local não existe mais nesta cena.");
  return document.object ?? document;
}

export class VisageExecutor {
  static async execute(step, context) {
    const api = visageApi();
    if (!api?.apply) throw new Error("A etapa Aplicar Visage exige o módulo Visage ativo.");
    const visageId = String(step.visageId ?? "").trim();
    if (!visageId) throw new Error("Escolha uma variação do Visage para aplicar.");
    const targets = step.mode === "local"
      ? [await localTarget(step.localTokenUuid)]
      : runtimeTargets(step.scope ?? "target", context);
    if (!targets.length) throw new Error("A etapa Aplicar Visage não encontrou tokens no escopo escolhido.");
    const unique = [...new Map(targets.map((target) => [target.document?.uuid ?? target.uuid ?? target.id, target])).values()];
    return Promise.all(unique.map((target) => api.apply(target, visageId)));
  }
}