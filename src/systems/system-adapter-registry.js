export class SystemAdapterRegistry {
  #adapters = new Map();

  register(systemId, adapter) {
    const id = typeof systemId === "string" ? systemId.trim() : "";
    if (!id) throw new Error("O ID do sistema precisa ser um texto não vazio.");
    if (!adapter || typeof adapter !== "object") throw new Error(`O adaptador ${id} precisa ser um objeto.`);
    if (this.#adapters.has(id)) throw new Error(`Já existe um adaptador para o sistema ${id}.`);
    this.#adapters.set(id, adapter);
    return this;
  }

  has(systemId) {
    return this.#adapters.has(systemId);
  }

  get(systemId = globalThis.game?.system?.id) {
    return this.#adapters.get(systemId) ?? null;
  }

  async getDefense(target, options = {}) {
    const adapter = this.get();
    if (!adapter?.getDefense) return null;
    const value = await adapter.getDefense(target, options);
    if (value == null) return null;
    const defense = Number(value);
    if (!Number.isFinite(defense)) throw new Error("O adaptador do sistema retornou uma Defesa inválida.");
    return defense;
  }

  async getResistance(target, damageType, options = {}) {
    const adapter = this.get();
    if (!adapter?.getResistance) return null;
    const value = await adapter.getResistance(target, damageType, options);
    if (value == null) return null;
    const resistance = Number(value);
    if (!Number.isFinite(resistance)) throw new Error("O adaptador do sistema retornou uma resistência inválida.");
    return resistance;
  }

  async getHpPercent(target, options = {}) {
    const adapter = this.get();
    if (!adapter?.getHpPercent) return null;
    const value = await adapter.getHpPercent(target, options);
    if (value == null) return null;
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent < 0) {
      throw new Error("O adaptador do sistema retornou um percentual de HP inválido.");
    }
    return percent;
  }

  async hasItem(target, query, options = {}) {
    const adapter = this.get();
    if (adapter?.hasItem) return Boolean(await adapter.hasItem(target, query, options));
    const items = target?.actor?.items ?? target?.items ?? [];
    return [...items].some((item) => this.#matchesDocument(item, query));
  }

  async hasEffect(target, query, options = {}) {
    const adapter = this.get();
    if (adapter?.hasEffect) return Boolean(await adapter.hasEffect(target, query, options));
    const effects = target?.actor?.effects ?? target?.effects ?? [];
    return [...effects].some((effect) => this.#matchesDocument(effect, query));
  }

  async hasTag(target, query, options = {}) {
    const adapter = this.get();
    if (adapter?.hasTag) return Boolean(await adapter.hasTag(target, query, options));
    const document = target?.document ?? target;
    const tags = document?.getFlag?.("tagger", "tags") ?? document?.flags?.tagger?.tags ?? [];
    return (Array.isArray(tags) ? tags : [tags]).some((tag) => String(tag) === String(query));
  }

  #matchesDocument(document, query) {
    const expected = String(query ?? "").toLocaleLowerCase();
    return [document?.id, document?.uuid, document?.name, document?.slug]
      .filter((value) => value != null)
      .some((value) => String(value).toLocaleLowerCase() === expected);
  }
}
