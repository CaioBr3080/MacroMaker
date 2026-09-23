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
}
