import { TARGET_MODES } from "../constants.js";
import { TargetingService } from "../targeting/targeting-service.js";
import { clone } from "../utils/safe-values.js";

export class ExecutionContext {
  constructor(project, macro, { targetingService = TargetingService, systemRegistry = null } = {}) {
    this.project = project;
    this.macro = macro;
    this.targetingService = targetingService;
    this.systems = systemRegistry;
    this.source = null;
    this.targets = [];
    this.target = null;
    this.location = null;
    this.template = null;
    this.variables = globalThis.foundry?.utils?.deepClone
      ? foundry.utils.deepClone(project.variables ?? {})
      : clone(project.variables ?? {});
    this.runtimeSteps = clone(project.steps ?? []);
    this.debugLog = [];
    this.branchStack = [];
    this.attack = null;
    this.damage = null;
    this.healing = null;
    this.rolls = [];
    this.hit = null;
    this.critical = false;
    this.lastRoll = null;
    this.lastResult = null;
    this.cancelled = false;
    this.executionId = foundry.utils.randomID();
  }

  recordDebug(entry) {
    const record = { timestamp: Date.now(), ...entry };
    this.debugLog.push(record);
    if (globalThis.game?.settings?.get?.("macro-maker", "debug")) {
      console.debug("Macro Maker | execução", record);
    }
    return record;
  }

  enterBranch(step) {
    const id = step?.id ?? step?.label ?? step?.type ?? "branch";
    if (this.branchStack.length >= 32) {
      throw new Error("Limite de 32 níveis de ramificação excedido.");
    }
    if (this.branchStack.includes(id)) {
      throw new Error(`Ciclo de ramificação detectado em ${step?.label ?? id}.`);
    }
    this.branchStack.push(id);
  }

  leaveBranch() {
    this.branchStack.pop();
  }

  async initialize() {
    const targeting = this.project.targeting ?? {};
    this.source = targeting.source === "none" ? null : canvas.tokens.controlled[0] ?? null;
    this.#validateSource();
    const result = await this.targetingService.resolve(targeting, { source: this.source });
    if (result.cancelled) {
      this.cancelled = true;
      return this;
    }
    this.targets = result.targets;
    this.target = this.targets[0] ?? null;
    this.location = result.location;
    this.template = result.template;

    this.#validateTargets();
    this.#validateRange();
    return this;
  }

  distanceTo(target = this.target ?? this.location) {
    if (!this.source || !target) return null;
    const destination = target.center ?? target;
    return canvas.grid.measurePath([
      this.source.center,
      destination
    ]).distance;
  }

  resolveLocation(reference) {
    if (reference === "source") return this.source;
    if (reference === "target") return this.target;
    if (reference === "location") return this.location;
    if (reference === "template") return this.template;
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
    const count = this.project.targeting?.mode === TARGET_MODES.POINT && this.location ? 1 : this.targets.length;
    if (count < min) throw new Error(`Selecione pelo menos ${min} alvo(s).`);
    if (count > max) throw new Error(`Selecione no máximo ${max} alvo(s).`);
  }

  #validateRange() {
    const configuredRange = this.project.targeting?.range;
    const range = Number(configuredRange);
    if (!this.project.targeting?.blockOutOfRange || configuredRange == null || !Number.isFinite(range)) return;
    const destinations = this.targets.length ? this.targets : this.location ? [this.location] : [];
    const invalid = destinations
      .map((target) => ({ target, distance: this.distanceTo(target) }))
      .find(({ distance }) => distance != null && distance > range);
    if (invalid) throw new Error(`Alvo fora do alcance (${invalid.distance} > ${range}).`);
  }
}
