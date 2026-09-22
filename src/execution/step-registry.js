function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export class StepRegistry {
  #definitions = new Map();

  register(type, definition) {
    const normalizedType = typeof type === "string" ? type.trim() : "";
    if (!normalizedType) throw new Error("O tipo da etapa precisa ser um texto não vazio.");
    if (!definition || typeof definition !== "object") {
      throw new Error(`A definição da etapa ${normalizedType} precisa ser um objeto.`);
    }
    if (typeof definition.execute !== "function") {
      throw new Error(`A etapa ${normalizedType} precisa definir execute(step, context).`);
    }
    if (this.#definitions.has(normalizedType)) {
      throw new Error(`O tipo de etapa ${normalizedType} já está registrado.`);
    }

    this.#definitions.set(normalizedType, Object.freeze({
      label: normalizedType,
      icon: "fas fa-puzzle-piece",
      defaults: {},
      schema: {},
      ...definition,
      type: normalizedType,
      defaults: clone(definition.defaults ?? {})
    }));
    return this;
  }

  has(type) {
    return this.#definitions.has(type);
  }

  get(type) {
    return this.#definitions.get(type) ?? null;
  }

  list() {
    return [...this.#definitions.values()];
  }

  create(type, overrides = {}) {
    const definition = this.get(type);
    if (!definition) throw new Error(`Tipo de etapa desconhecido: ${type}.`);
    return { ...clone(definition.defaults), ...clone(overrides), type };
  }

  async execute(step, context) {
    const definition = this.get(step?.type);
    if (!definition) throw new Error(`Tipo de etapa desconhecido: ${step?.type ?? "(vazio)"}.`);
    return definition.execute(step, context);
  }
}
