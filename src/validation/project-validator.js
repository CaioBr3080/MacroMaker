import {
  EXECUTION_EVENTS,
  ROLL_MODES,
  SCHEMA_VERSION,
  STEP_TYPES,
  TARGET_FILTERS,
  TARGET_MODES
} from "../constants.js";
import { createId, isSafeId } from "../utils/ids.js";
import { safePath } from "../utils/safe-values.js";
import { MESSAGE_FONTS } from "../utils/message-style.js";

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
    if (project.id == null) project.id = createId("project");
    else if (!isSafeId(project.id)) issues.push({ path: "id", message: "O ID do projeto é inválido." });
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
      const stepIds = new Set();
      project.steps.forEach((step, index) => this.#normalizeStep(step, index, issues, stepRegistry, {
        path: `steps.${index}`,
        depth: 0,
        stepIds
      }));
    }

    if (project.metadata != null && !isRecord(project.metadata)) {
      issues.push({ path: "metadata", message: "metadata precisa ser um objeto." });
    }

    project.sharing ??= { observerCanExecute: true, lockedFields: [] };
    if (!isRecord(project.sharing)) {
      issues.push({ path: "sharing", message: "sharing precisa ser um objeto." });
    } else {
      const sharing = project.sharing;
      sharing.observerCanExecute ??= true;
      if (typeof sharing.observerCanExecute !== "boolean") {
        issues.push({ path: "sharing.observerCanExecute", message: "observerCanExecute precisa ser booleano." });
      }
      if (sharing.level != null && ![0, 2, 3].includes(Number(sharing.level))) {
        issues.push({ path: "sharing.level", message: "Nível de acesso inválido." });
      } else if (sharing.level != null) sharing.level = Number(sharing.level);
      if (sharing.hotbarSlot != null && sharing.hotbarSlot !== "") {
        this.#normalizeInteger(sharing, "hotbarSlot", "sharing.hotbarSlot", issues, { minimum: 1 });
        if (Number(sharing.hotbarSlot) > 50) issues.push({ path: "sharing.hotbarSlot", message: "O slot da hotbar deve ser no máximo 50." });
      }
      const locks = Array.isArray(sharing.lockedFields)
        ? sharing.lockedFields
        : String(sharing.lockedFields ?? "").split(",").map((path) => path.trim()).filter(Boolean);
      if (locks.some((path) => !safePath(path))) {
        issues.push({ path: "sharing.lockedFields", message: "Há um caminho de campo bloqueado inválido." });
      }
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
    targeting.clearTargetsAfterExecution ??= false;
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
    if (typeof targeting.clearTargetsAfterExecution !== "boolean") {
      issues.push({ path: "targeting.clearTargetsAfterExecution", message: "clearTargetsAfterExecution precisa ser booleano." });
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

  static #normalizeStep(step, index, issues, stepRegistry, { path = `steps.${index}`, depth = 0, stepIds = new Set() } = {}) {
    if (!isRecord(step)) {
      issues.push({ path, message: `A etapa ${index + 1} precisa ser um objeto.` });
      return;
    }
    if (depth > 32) {
      issues.push({ path, message: "A árvore de ramificações excede 32 níveis." });
      return;
    }
    if (step.id == null) step.id = createId("step");
    else if (!isSafeId(step.id)) issues.push({ path: `${path}.id`, message: `O ID da etapa ${index + 1} é inválido.` });
    if (stepIds.has(step.id)) issues.push({ path: `${path}.id`, message: `ID de etapa duplicado: ${step.id}.` });
    stepIds.add(step.id);
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
    } else {
      step.conditions?.forEach((condition, conditionIndex) => this.#normalizeCondition(
        condition,
        `${path}.conditions.${conditionIndex}`,
        issues,
        depth
      ));
    }
    if (step.event != null && !EXECUTION_EVENTS.includes(step.event)) {
      issues.push({ path: `${path}.event`, message: `Evento inválido na etapa ${index + 1}: ${step.event}.` });
    }
    if (step.rollMode != null && !ROLL_MODES.includes(step.rollMode)) {
      issues.push({ path: `${path}.rollMode`, message: `Modo de rolagem inválido na etapa ${index + 1}.` });
    }

    if (step.type === STEP_TYPES.MENU) this.#normalizeMenu(step, path, issues);
    if (step.type === STEP_TYPES.SET_VARIABLE) this.#normalizeVariableStep(step, path, issues);
    if (step.type === STEP_TYPES.BRANCH) {
      this.#normalizeCondition(step.condition, `${path}.condition`, issues, depth);
      for (const branch of ["then", "else"]) {
        step[branch] ??= [];
        if (!Array.isArray(step[branch])) {
          issues.push({ path: `${path}.${branch}`, message: `${branch} precisa ser uma lista de etapas.` });
          continue;
        }
        step[branch].forEach((child, childIndex) => this.#normalizeStep(child, childIndex, issues, stepRegistry, {
          path: `${path}.${branch}.${childIndex}`,
          depth: depth + 1,
          stepIds
        }));
      }
    }
    if (step.type === STEP_TYPES.MUTATE_STEPS) this.#normalizeMutation(step, path, issues, stepRegistry, depth, stepIds);
    if (step.type === STEP_TYPES.ANIMATION) this.#normalizePersistence(step, path, issues);
    if (step.type === STEP_TYPES.REMOVE_PERSISTENT) this.#normalizePersistentRemoval(step, path, issues);
    if (step.type === STEP_TYPES.ASSET_PRESET) this.#normalizeAssetPreset(step, path, issues);
    if (step.type === STEP_TYPES.SUMMON) this.#normalizeSummon(step, path, issues);

    const rollTypes = [STEP_TYPES.ATTACK, STEP_TYPES.TEST, STEP_TYPES.DAMAGE, STEP_TYPES.HEALING, STEP_TYPES.ROLL];
    if (!rollTypes.includes(step.type)) return;

    for (const styleName of ["messageStyle", "speakerStyle"]) {
      const style = step[styleName];
      if (style == null) continue;
      if (!isRecord(style)) issues.push({ path: `${path}.${styleName}`, message: `A formatação ${styleName} precisa ser um objeto.` });
      else {
        if (style.font != null && !Object.hasOwn(MESSAGE_FONTS, style.font)) issues.push({ path: `${path}.${styleName}.font`, message: "Fonte de mensagem inválida." });
        if (style.color != null && !/^#[0-9a-f]{6}$/i.test(style.color)) issues.push({ path: `${path}.${styleName}.color`, message: "Use uma cor no formato #RRGGBB." });
        this.#normalizeOptionalNumber(style, "size", `${path}.${styleName}.size`, issues, { minimum: 8, maximum: 72 });
        if (style.align != null && !["left", "center", "right"].includes(style.align)) issues.push({ path: `${path}.${styleName}.align`, message: "Alinhamento inválido." });
        for (const key of ["bold", "italic", "underline"]) {
          if (style[key] != null && typeof style[key] !== "boolean") issues.push({ path: `${path}.${styleName}.${key}`, message: "O estilo precisa ser booleano." });
        }
      }
    }
    if (step.speakerAppend != null && typeof step.speakerAppend !== "string") {
      issues.push({ path: `${path}.speakerAppend`, message: "O complemento do nome precisa ser texto." });
    }
    if (step.announceTargets != null && typeof step.announceTargets !== "boolean") {
      issues.push({ path: path + ".announceTargets", message: "O registro de alvos precisa ser booleano." });
    }
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

  static #normalizeCondition(condition, path, issues, depth = 0) {
    if (!isRecord(condition)) {
      issues.push({ path, message: "A condição precisa ser um objeto." });
      return;
    }
    const types = [
      "always", "group", "critical", "notCritical", "hit", "miss", "distance", "distanceAbove",
      "distanceAtMost", "rollValue", "rollTotal", "damage", "damageValue", "naturalDie", "hpPercent",
      "hasItem", "hasEffect", "hasTag", "targetCount", "variable", "variableEquals", "menuOption"
    ];
    if (!types.includes(condition.type)) {
      issues.push({ path: `${path}.type`, message: `Tipo de condição desconhecido: ${condition.type}.` });
      return;
    }
    if (condition.type === "group") {
      if (!['and', 'or', 'not'].includes(condition.operator)) {
        issues.push({ path: `${path}.operator`, message: "O operador do grupo deve ser AND, OR ou NOT." });
      }
      if (!Array.isArray(condition.children) || condition.children.length === 0) {
        issues.push({ path: `${path}.children`, message: "O grupo precisa de ao menos uma condição." });
        return;
      }
      if (condition.operator === "not" && condition.children.length !== 1) {
        issues.push({ path: `${path}.children`, message: "Um grupo NOT precisa ter exatamente uma condição." });
      }
      if (depth >= 32) {
        issues.push({ path, message: "A árvore de condições excede 32 níveis." });
        return;
      }
      condition.children.forEach((child, index) => this.#normalizeCondition(child, `${path}.children.${index}`, issues, depth + 1));
    }
    if (["variable", "variableEquals", "menuOption"].includes(condition.type) && !safePath(condition.key)) {
      issues.push({ path: `${path}.key`, message: "A condição precisa de um nome de variável válido." });
    }
    if (condition.operator != null && !["eq", "neq", "gt", "gte", "lt", "lte", "includes", "and", "or", "not"].includes(condition.operator)) {
      issues.push({ path: `${path}.operator`, message: `Operador de condição inválido: ${condition.operator}.` });
    }
  }

  static #normalizeMenu(step, path, issues) {
    if (!safePath(step.variable ?? "choice")) {
      issues.push({ path: `${path}.variable`, message: "O menu precisa de um nome de variável válido." });
    }
    if (!Array.isArray(step.options) || step.options.length === 0) {
      issues.push({ path: `${path}.options`, message: "O menu precisa de ao menos uma opção." });
    } else {
      step.options.forEach((option, index) => {
        if (!isRecord(option)) issues.push({ path: `${path}.options.${index}`, message: "A opção precisa ser um objeto." });
        else if (typeof option.label !== "string" || !option.label.trim()) {
          issues.push({ path: `${path}.options.${index}.label`, message: "A opção precisa de um rótulo." });
        }
        if (isRecord(option) && option.column != null && option.column !== "") {
          const column = Number(option.column);
          if (!Number.isInteger(column) || column < 1 || column > 6) {
            issues.push({ path: path + ".options." + index + ".column", message: "A coluna precisa ser um número inteiro entre 1 e 6." });
          } else option.column = column;
        }
      });
    }
    if (step.selection != null && !["single", "multiple"].includes(step.selection)) {
      issues.push({ path: `${path}.selection`, message: "A seleção do menu deve ser single ou multiple." });
    }
    if (step.cancelBehavior != null && !["abort", "default", "continue"].includes(step.cancelBehavior)) {
      issues.push({ path: `${path}.cancelBehavior`, message: "Comportamento de cancelamento inválido." });
    }
    this.#normalizeOptionalNumber(step, "columns", `${path}.columns`, issues, { minimum: 1 });
    if (Number(step.columns) > 6) issues.push({ path: `${path}.columns`, message: "O menu aceita no máximo 6 colunas." });
    if (step.columnSettings != null) {
      if (!isRecord(step.columnSettings)) {
        issues.push({ path: path + ".columnSettings", message: "As configurações das colunas precisam ser um objeto." });
      } else {
        for (const [key, settings] of Object.entries(step.columnSettings)) {
          const column = Number(key);
          const settingsPath = path + ".columnSettings." + key;
          if (!Number.isInteger(column) || column < 1 || column > 6) {
            issues.push({ path: settingsPath, message: "A configuração precisa apontar para uma coluna de 1 a 6." });
          } else if (!isRecord(settings)) {
            issues.push({ path: settingsPath, message: "A configuração da coluna precisa ser um objeto." });
          } else {
            if (settings.title != null && typeof settings.title !== "string") {
              issues.push({ path: settingsPath + ".title", message: "O título da coluna precisa ser texto." });
            }
            if (settings.textTransform != null && !["none", "upper", "lower", "capitalize"].includes(settings.textTransform)) {
              issues.push({ path: settingsPath + ".textTransform", message: "A padronização de texto da coluna é inválida." });
            }
          }
        }
      }
    }
  }

  static #normalizeVariableStep(step, path, issues) {
    if (!safePath(step.variable)) issues.push({ path: `${path}.variable`, message: "Nome de variável inválido." });
    if (!["set", "add", "subtract", "multiply", "append", "toggle"].includes(step.operation ?? "set")) {
      issues.push({ path: `${path}.operation`, message: "Transformação de variável inválida." });
    }
    if (!["auto", "string", "number", "boolean", "array", "formula"].includes(step.valueType ?? "auto")) {
      issues.push({ path: `${path}.valueType`, message: "Tipo de variável inválido." });
    }
  }

  static #normalizeMutation(step, path, issues, stepRegistry, depth, stepIds) {
    if (!["add", "remove", "replace", "modify"].includes(step.action ?? "modify")) {
      issues.push({ path: `${path}.action`, message: "Ação de alteração de etapa inválida." });
      return;
    }
    if (["add", "replace"].includes(step.action)) {
      this.#normalizeStep(step.step, 0, issues, stepRegistry, {
        path: `${path}.step`,
        depth: depth + 1,
        stepIds
      });
    }
    if (step.action === "modify" && !isRecord(step.changes)) {
      issues.push({ path: `${path}.changes`, message: "As modificações precisam ser um objeto." });
    }
  }

  static #normalizePersistence(step, path, issues) {
    if (step.duplicatePolicy != null && !["replace", "skip", "stack"].includes(step.duplicatePolicy)) {
      issues.push({ path: `${path}.duplicatePolicy`, message: "Política de duplicação inválida." });
    }
    for (const key of ["durationSeconds", "durationRounds"]) {
      this.#normalizeOptionalNumber(step, key, `${path}.${key}`, issues, { minimum: 0 });
    }
    if (step.attachTo != null && ![true, false, "source", "target", "location"].includes(step.attachTo)) {
      issues.push({ path: `${path}.attachTo`, message: "Vínculo persistente inválido." });
    }
    for (const key of ["stretchTo", "rotateTowardsTarget"]) {
      if (step[key] != null && typeof step[key] !== "boolean") {
        issues.push({ path: path + "." + key, message: key + " precisa ser booleano." });
      }
    }
    if (step.distanceBehavior != null) {
      if (!isRecord(step.distanceBehavior)) {
        issues.push({ path: path + ".distanceBehavior", message: "distanceBehavior precisa ser um objeto." });
      } else {
        this.#normalizeOptionalNumber(step.distanceBehavior, "stretchAfter", path + ".distanceBehavior.stretchAfter", issues, { minimum: 0 });
      }
    }
    this.#normalizeOptionalNumber(step, "scale", path + ".scale", issues, { minimum: 0 });
    this.#normalizeOptionalNumber(step, "scaleToObject", path + ".scaleToObject", issues, { minimum: 0 });
    this.#normalizeOptionalNumber(step, "rotation", path + ".rotation", issues);
  }

  static #normalizePersistentRemoval(step, path, issues) {
    if (step.scope != null && !["step", "name", "source", "target", "project", "tag", "all"].includes(step.scope)) {
      issues.push({ path: `${path}.scope`, message: "Escopo de remoção persistente inválido." });
    }
  }

  static #normalizeAssetPreset(step, path, issues) {
    if ((!step.presetUuid || typeof step.presetUuid !== "string") && (!step.presetName || typeof step.presetName !== "string")) {
      issues.push({ path: path + ".presetUuid", message: "Escolha um preset do Baileywiki Mass Edit." });
    }
    if (step.presetName != null && typeof step.presetName !== "string") {
      issues.push({ path: path + ".presetName", message: "O nome do preset precisa ser texto." });
    }
    if (step.presetType != null && typeof step.presetType !== "string") {
      issues.push({ path: path + ".presetType", message: "O tipo do preset precisa ser texto." });
    }
    if (step.destination != null && !["source", "target", "location"].includes(step.destination)) {
      issues.push({ path: path + ".destination", message: "Posição do asset inválida." });
    }
    for (const key of ["pickPosition", "snapToGrid", "hidden"]) {
      if (step[key] != null && typeof step[key] !== "boolean") {
        issues.push({ path: path + "." + key, message: "A opção do asset precisa ser booleano." });
      }
    }
  }

  static #normalizeSummon(step, path, issues) {
    if (typeof step.actorId !== "string" || !step.actorId) {
      issues.push({ path: path + ".actorId", message: "Escolha o Ator que será invocado." });
    }
    if (step.tokenName != null && typeof step.tokenName !== "string") {
      issues.push({ path: path + ".tokenName", message: "O nome do token precisa ser texto." });
    }
    this.#normalizeOptionalNumber(step, "count", path + ".count", issues, { minimum: 1, maximum: 20 });
    if (step.count != null && Number.isFinite(Number(step.count)) && !Number.isInteger(Number(step.count))) {
      issues.push({ path: path + ".count", message: "A quantidade invocada precisa ser inteira." });
    }
    if (step.destination != null && !["source", "target", "location"].includes(step.destination)) {
      issues.push({ path: path + ".destination", message: "Posição da invocação inválida." });
    }
    if (step.disposition != null && ![-1, 0, 1].includes(Number(step.disposition))) {
      issues.push({ path: path + ".disposition", message: "Disposição da invocação inválida." });
    } else if (step.disposition != null) step.disposition = Number(step.disposition);
    if (step.visageId != null && typeof step.visageId !== "string") {
      issues.push({ path: path + ".visageId", message: "A variação do Visage precisa ser texto." });
    }
    for (const key of ["snapToGrid", "hidden"]) {
      if (step[key] != null && typeof step[key] !== "boolean") {
        issues.push({ path: path + "." + key, message: "A opção de invocação precisa ser booleano." });
      }
    }
  }
  static #normalizeOptionalNumber(object, key, path, issues, { minimum = -Infinity, maximum = Infinity } = {}) {
    if (object[key] == null || object[key] === "") return;
    const number = Number(object[key]);
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      issues.push({ path, message: `${path} precisa ser um número maior ou igual a ${minimum}${Number.isFinite(maximum) ? ` e no máximo ${maximum}` : ""}.` });
      return;
    }
    object[key] = number;
  }
}
