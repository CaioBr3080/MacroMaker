const MODULE_ID = "tokenmagic";

function service() {
  const module = globalThis.game?.modules?.get?.(MODULE_ID);
  if (!module?.active) return null;
  return globalThis.TokenMagic ?? module.api ?? null;
}

function placeableFor(step, context) {
  const placeable = context.resolveLocation?.(step.destination ?? "target");
  if (!placeable?.document && typeof placeable?.TMFXaddFilters !== "function") {
    throw new Error("A etapa Token Magic precisa de um executante, alvo ou template no canvas.");
  }
  return placeable;
}

function filterParameters(step, { required = true } = {}) {
  const preset = String(step.preset ?? "").trim();
  if (preset) return preset;
  const raw = String(step.filters ?? "").trim();
  if (!raw) {
    if (required) throw new Error("Informe um preset do Token Magic ou os filtros em JSON.");
    return null;
  }
  let filters;
  try {
    filters = JSON.parse(raw);
  } catch (_error) {
    throw new Error("Os filtros do Token Magic precisam ser um JSON válido.");
  }
  if (!Array.isArray(filters) || filters.length === 0) {
    throw new Error("Os filtros do Token Magic precisam ser uma lista JSON não vazia.");
  }
  return filters;
}

export class TokenMagicAdapter {
  static get available() {
    return Boolean(service()?.addFilters);
  }

  static async apply(step, context) {
    const api = service();
    if (!api?.addFilters) {
      throw new Error("A etapa Token Magic FX exige o módulo Token Magic FX ativo.");
    }

    const placeable = placeableFor(step, context);
    const operation = step.operation ?? "add";
    if (operation === "remove") {
      const filterId = String(step.filterId ?? "").trim();
      if (!filterId) throw new Error("Informe o Filter ID para remover um efeito do Token Magic.");
      if (!api.deleteFilters) throw new Error("A versão ativa do Token Magic não oferece remoção de filtros.");
      return api.deleteFilters(placeable, filterId);
    }

    const parameters = filterParameters(step);
    if (operation === "update") {
      if (!api.updateFiltersByPlaceable) {
        throw new Error("A versão ativa do Token Magic não oferece atualização de filtros.");
      }
      return api.updateFiltersByPlaceable(parameters, placeable);
    }
    if (operation !== "add") throw new Error("Operação Token Magic desconhecida: " + operation + ".");
    return api.addFilters(placeable, parameters, step.replace === true);
  }
}