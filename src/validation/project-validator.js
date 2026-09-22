import { SCHEMA_VERSION, TARGET_MODES } from "../constants.js";

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
    targeting.minTargets ??= 0;
    targeting.maxTargets ??= 1;
    targeting.range ??= null;
    targeting.blockOutOfRange ??= false;

    if (!["controlled", "none"].includes(targeting.source)) {
      issues.push({ path: "targeting.source", message: "Origem de targeting inválida." });
    }
    if (!Object.values(TARGET_MODES).includes(targeting.mode)) {
      issues.push({ path: "targeting.mode", message: "Modo de targeting inválido." });
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
  }
}
