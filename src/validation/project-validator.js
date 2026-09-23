import {
  EXECUTION_EVENTS,
  ROLL_MODES,
  SCHEMA_VERSION,
  STEP_TYPES,
  TARGET_FILTERS,
  TARGET_MODES
} from "../constants.js";

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export class ProjectValidationError extends Error {
  constructor(issues) {
    const suffix = issues.length > 1 ? ` (+${issues.length - 1} erro(s))` : "";
    super(`${issues[0]?.message ?? "Projeto inválido."}${suffix}`);
    this.name = "ProjectValidationError";
    this.issues = issues;
  }
}

export class ProjectValidator {
  static normalize(input, { stepRegistry = null } = {}) {
    const issues = [];
    if (!isRecord(input)) {
      throw new ProjectValidationError([
        { path: "", message: "O projeto precisa ser um objeto JSON." }
      ]);
    }

    const project = clone(input);
    project.schemaVersion ??= SCHEMA_VERSION;
    if (!Number.isInteger(project.schemaVersion)) {
      issues.push({ path: "schemaVersion", message: "schemaVersion precisa ser um número inteiro." });
    } else if (project.schemaVersion !== SCHEMA_VERSION) {
      issues.push({
        path: "schemaVersion",
        message: `Schema ${project.schemaVersion} não suportado; a versão atual é ${SCHEMA_VERSION}.`
      });
    }

    if (typeof project.name !== "string" || !project.name.trim()) {
      issues.push({ path: "name", message: "O projeto precisa de um nome." });
    } else {
      project.name = project.name.trim();
    }

    if (project.description != null && typeof project.description !== "string") {
      issues.push({ path: "description", message: "description precisa ser texto." });
    }
    if (project.icon != null && typeof project.icon !== "string") {
      issues.push({ path: "icon", message: "icon precisa ser texto." });
    }

    this.#normalizeTargeting(project, issues);

    project.variables ??= {};
    if (!isRecord(project.variables)) {
      issues.push({ path: "variables", message: "variables precisa ser um objeto." });
    }

    project.steps ??= [];
    if (!Array.isArray(project.steps)) {
      issues.push({ path: "steps", message: "project.steps precisa ser uma lista." });
    } else {
      project.steps.forEach((step, index) => this.#normalizeStep(step, index, issues, stepRegistry));
    }

    if (project.metadata != null && !isRecord(project.metadata)) {
      issues.push({ path: "metadata", message: "metadata precisa ser um objeto." });
    }

    if (issues.length) throw new ProjectValidationError(issues);
    return project;
  }

  static #normalizeTargeting(project, issues) {
    project.targeting ??= {};
    if (!isRecord(project.targeting)) {
      issues.push({ path: "targeting", message: "targeting precisa ser um objeto." });
      return;
    }

    const targeting = project.targeting;
    targeting.source ??= "controlled";
    targeting.mode ??= TARGET_MODES.CURRENT_TARGETS;
    targeting.filter ??= TARGET_FILTERS.ALL;
    targeting.minTargets ??= 0;
    targeting.maxTargets ??= 1;
    targeting.range ??= null;
    targeting.blockOutOfRange ??= false;
    targeting.radius ??= 3;
    targeting.angle ??= 90;
    targeting.width ??= 1;

    if (!["controlled", "none"].includes(targeting.source)) {
      issues.push({ path: "targeting.source", message: "Origem de targeting inválida." });
    }
    if (!Object.values(TARGET_MODES).includes(targeting.mode)) {
      issues.push({ path: "targeting.mode", message: "Modo de targeting inválido." });
    }
    if (!Object.values(TARGET_FILTERS).includes(targeting.filter)) {
      issues.push({ path: "targeting.filter", message: "Filtro de targeting inválido." });
    }

    this.#normalizeInteger(targeting, "minTargets", "targeting.minTargets", issues, { minimum: 0 });
    this.#normalizeInteger(targeting, "maxTargets", "targeting.maxTargets", issues, { minimum: 0 });
    if (Number.isInteger(targeting.minTargets)
      && Number.isInteger(targeting.maxTargets)
      && targeting.maxTargets < targeting.minTargets) {
      issues.push({
        path: "targeting.maxTargets",
        message: "maxTargets não pode ser menor que minTargets."
      });
    }

    if (targeting.range !== null) {
      const range = Number(targeting.range);
      if (!Number.isFinite(range) || range < 0) {
        issues.push({ path: "targeting.range", message: "range precisa ser nulo ou um número não negativo." });
      } else {
        targeting.range = range;
      }
    }
    if (typeof targeting.blockOutOfRange !== "boolean") {
      issues.push({ path: "targeting.blockOutOfRange", message: "blockOutOfRange precisa ser booleano." });
    }
    this.#normalizePositiveNumber(targeting, "radius", "targeting.radius", issues);
    this.#normalizePositiveNumber(targeting, "angle", "targeting.angle", issues, { maximum: 360 });
    this.#normalizePositiveNumber(targeting, "width", "targeting.width", issues);
  }

  static #normalizePositiveNumber(object, key, path, issues, { maximum = Infinity } = {}) {
    const number = Number(object[key]);
    if (!Number.isFinite(number) || number <= 0 || number > maximum) {
      issues.push({ path, message: `${path} precisa ser um número maior que zero${Number.isFinite(maximum) ? ` e menor ou igual a ${maximum}` : ""}.` });
      return;
    }
    object[key] = number;
  }

  static #normalizeInteger(object, key, path, issues, { minimum } = {}) {
    const number = typeof object[key] === "string" && object[key].trim() !== ""
      ? Number(object[key])
      : object[key];
    if (!Number.isInteger(number) || (minimum != null && number < minimum)) {
      issues.push({ path, message: `${path} precisa ser um número inteiro${minimum != null ? ` maior ou igual a ${minimum}` : ""}.` });
      return;
    }
    object[key] = number;
  }

  static #normalizeStep(step, index, issues, stepRegistry) {
    const path = `steps.${index}`;
    if (!isRecord(step)) {
      issues.push({ path, message: `A etapa ${index + 1} precisa ser um objeto.` });
      return;
    }
    if (typeof step.type !== "string" || !step.type.trim()) {
      issues.push({ path: `${path}.type`, message: `A etapa ${index + 1} não possui type.` });
      return;
    }
    step.type = step.type.trim();
    if (stepRegistry && !stepRegistry.has(step.type)) {
      issues.push({ path: `${path}.type`, message: `Tipo de etapa desconhecido: ${step.type}.` });
    }
    if (step.enabled != null && typeof step.enabled !== "boolean") {
      issues.push({ path: `${path}.enabled`, message: `enabled da etapa ${index + 1} precisa ser booleano.` });
    }
    if (step.conditions != null && !Array.isArray(step.conditions)) {
      issues.push({ path: `${path}.conditions`, message: `conditions da etapa ${index + 1} precisa ser uma lista.` });
    }
    if (step.event != null && !EXECUTION_EVENTS.includes(step.event)) {
      issues.push({ path: `${path}.event`, message: `Evento inválido na etapa ${index + 1}: ${step.event}.` });
    }
    if (step.rollMode != null && !ROLL_MODES.includes(step.rollMode)) {
      issues.push({ path: `${path}.rollMode`, message: `Modo de rolagem inválido na etapa ${index + 1}.` });
    }

    const rollTypes = [STEP_TYPES.ATTACK, STEP_TYPES.TEST, STEP_TYPES.DAMAGE, STEP_TYPES.HEALING, STEP_TYPES.ROLL];
    if (!rollTypes.includes(step.type)) return;

    if (step.type === STEP_TYPES.ATTACK && step.hitMode != null && !["auto", "manual"].includes(step.hitMode)) {
      issues.push({ path: `${path}.hitMode`, message: `Modo de acerto inválido na etapa ${index + 1}.` });
    }
    if (step.defense != null && step.defense !== "" && !Number.isFinite(Number(step.defense))) {
      issues.push({ path: `${path}.defense`, message: `A defesa da etapa ${index + 1} precisa ser numérica.` });
    } else if (step.defense != null && step.defense !== "") {
      step.defense = Number(step.defense);
    }
    this.#normalizeOptionalNumber(step, "criticalThreshold", `${path}.criticalThreshold`, issues, { minimum: 1 });
    this.#normalizeOptionalNumber(step, "criticalMargin", `${path}.criticalMargin`, issues, { minimum: 0 });
    this.#normalizeOptionalNumber(step, "criticalMultiplier", `${path}.criticalMultiplier`, issues, { minimum: 1 });

    const supportsParts = [STEP_TYPES.DAMAGE, STEP_TYPES.HEALING].includes(step.type);
    if (step.parts != null && !supportsParts) {
      issues.push({ path: `${path}.parts`, message: `A etapa ${index + 1} não aceita componentes.` });
    } else if (step.parts != null) {
      if (!Array.isArray(step.parts) || step.parts.length === 0) {
        issues.push({ path: `${path}.parts`, message: `Os componentes da etapa ${index + 1} precisam formar uma lista não vazia.` });
        return;
      }
      step.parts.forEach((part, partIndex) => {
        const partPath = `${path}.parts.${partIndex}`;
        if (!isRecord(part)) {
          issues.push({ path: partPath, message: `O componente ${partIndex + 1} precisa ser um objeto.` });
          return;
        }
        if (typeof part.formula !== "string" || !part.formula.trim()) {
          issues.push({ path: `${partPath}.formula`, message: `O componente ${partIndex + 1} precisa de uma fórmula.` });
        }
        if (part.type != null && typeof part.type !== "string") {
          issues.push({ path: `${partPath}.type`, message: `O tipo do componente ${partIndex + 1} precisa ser texto.` });
        }
        if (part.criticalFormula != null && typeof part.criticalFormula !== "string") {
          issues.push({ path: `${partPath}.criticalFormula`, message: `A fórmula crítica do componente ${partIndex + 1} precisa ser texto.` });
        }
        this.#normalizeOptionalNumber(part, "criticalMultiplier", `${partPath}.criticalMultiplier`, issues, { minimum: 1 });
      });
    } else if (typeof step.formula !== "string" || !step.formula.trim()) {
      issues.push({ path: `${path}.formula`, message: `A etapa ${index + 1} precisa de uma fórmula.` });
    }
  }

  static #normalizeOptionalNumber(object, key, path, issues, { minimum = -Infinity } = {}) {
    if (object[key] == null || object[key] === "") return;
    const number = Number(object[key]);
    if (!Number.isFinite(number) || number < minimum) {
      issues.push({ path, message: `${path} precisa ser um número maior ou igual a ${minimum}.` });
      return;
    }
    object[key] = number;
  }
}
