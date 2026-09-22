import { TARGET_MODES } from "../constants.js";

export class ExecutionContext {
  constructor(project, macro) {
    this.project = project;
    this.macro = macro;
    this.source = null;
    this.targets = [];
    this.target = null;
    this.variables = foundry.utils.deepClone(project.variables ?? {});
    this.attack = null;
    this.hit = null;
    this.critical = false;
    this.lastRoll = null;
  }

  async initialize() {
    this.source = canvas.tokens.controlled[0] ?? null;
    const mode = this.project.targeting?.mode ?? TARGET_MODES.CURRENT_TARGETS;

    if (mode === TARGET_MODES.CURRENT_TARGETS) this.targets = [...game.user.targets];
    if (mode === TARGET_MODES.CONTROLLED) this.targets = [...canvas.tokens.controlled].slice(1);
    if (mode === TARGET_MODES.NONE) this.targets = [];
    this.target = this.targets[0] ?? null;

    this.#validateSource();
    this.#validateTargets();
    this.#validateRange();
    return this;
  }

  distanceTo(target = this.target) {
    if (!this.source || !target) return null;
    return canvas.grid.measurePath([
      this.source.center,
      target.center
    ]).distance;
  }

  location(reference) {
    if (reference === "source") return this.source;
    if (reference === "target") return this.target;
    return null;
  }

  #validateSource() {
    if (this.project.targeting?.source === "controlled" && !this.source) {
      throw new Error("Selecione o token executante.");
    }
  }

  #validateTargets() {
    const min = Number(this.project.targeting?.minTargets ?? 0);
    const max = Number(this.project.targeting?.maxTargets ?? Infinity);
    if (this.targets.length < min) throw new Error(`Selecione pelo menos ${min} alvo(s).`);
    if (this.targets.length > max) throw new Error(`Selecione no máximo ${max} alvo(s).`);
  }

  #validateRange() {
    const range = Number(this.project.targeting?.range);
    if (!this.project.targeting?.blockOutOfRange || !Number.isFinite(range) || !this.target) return;
    const distance = this.distanceTo();
    if (distance > range) throw new Error(`Alvo fora do alcance (${distance} > ${range}).`);
  }
}
