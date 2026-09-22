function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export class ProjectHistory {
  #entries = [];
  #index = -1;

  constructor(initialState, { limit = 50 } = {}) {
    this.limit = Math.max(2, Number(limit) || 50);
    this.reset(initialState);
  }

  get canUndo() {
    return this.#index > 0;
  }

  get canRedo() {
    return this.#index >= 0 && this.#index < this.#entries.length - 1;
  }

  reset(state) {
    this.#entries = [clone(state)];
    this.#index = 0;
  }

  commit(state) {
    const snapshot = clone(state);
    if (JSON.stringify(snapshot) === JSON.stringify(this.#entries[this.#index])) return false;
    this.#entries.splice(this.#index + 1);
    this.#entries.push(snapshot);
    if (this.#entries.length > this.limit) this.#entries.shift();
    this.#index = this.#entries.length - 1;
    return true;
  }

  undo() {
    if (!this.canUndo) return null;
    this.#index -= 1;
    return clone(this.#entries[this.#index]);
  }

  redo() {
    if (!this.canRedo) return null;
    this.#index += 1;
    return clone(this.#entries[this.#index]);
  }
}
