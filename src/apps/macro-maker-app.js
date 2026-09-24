import { createDefaultProject } from "../data/default-project.js";
import { createCoreStepRegistry } from "../execution/core-step-registry.js";
import { ProjectRepository } from "../services/project-repository.js";
import { ProjectValidationError, ProjectValidator } from "../validation/project-validator.js";
import { ProjectHistory } from "./project-history.js";
import { createId } from "../utils/ids.js";
import { FIELD_HELP, folderChoices, targetingFieldActive, moveStepTo, validateVariableName, parseVariableValue } from "./editor-controls.js";
import { MESSAGE_FONTS, messageStyleCSS } from "../utils/message-style.js";
import { interpolate } from "../utils/safe-values.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DELETE_VALUE = Symbol("delete-value");

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function summonActors() {
  return [...(game.actors?.contents ?? [])]
    .filter((actor) => actor.visible !== false)
    .map((actor) => ({ id: actor.id, name: actor.name, img: actor.img }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { numeric: true }));
}

function visageChoices(actorId, selectedId) {
  const module = game.modules?.get?.("visage");
  const data = module?.active ? module.api?.Data : null;
  const actor = actorId ? game.actors?.get?.(actorId) : null;
  const entries = [
    ...(data?.globals ?? []),
    ...(actor && data?.getLocal ? data.getLocal(actor) : [])
  ];
  const unique = new Map();
  for (const entry of entries) {
    const id = entry?.id ?? entry?._id;
    if (!id || unique.has(id)) continue;
    unique.set(id, {
      id,
      name: entry.label ?? entry.name ?? id,
      selected: id === selectedId
    });
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { numeric: true }));
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = object;
  for (const key of keys) {
    cursor[key] ??= {};
    cursor = cursor[key];
  }
  if (value === DELETE_VALUE) delete cursor[last];
  else cursor[last] = value;
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function deletePath(object, path) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((value, key) => value?.[key], object);
  if (Array.isArray(parent)) parent.splice(Number(last), 1);
  else if (parent) delete parent[last];
}

function flattenConditions(condition, path, { deletable = true, depth = 0 } = {}) {
  if (!condition) return [];
  const node = {
    ...condition,
    path,
    depth,
    indent: depth * 18,
    isGroup: condition.type === "group",
    deletable
  };
  const children = condition.type === "group"
    ? (condition.children ?? []).flatMap((child, index) => flattenConditions(child, `${path}.children.${index}`, { depth: depth + 1 }))
    : [];
  return [node, ...children];
}

function saveJson(data, filename) {
  const save = globalThis.foundry?.utils?.saveDataToFile ?? globalThis.saveDataToFile;
  if (!save) throw new Error("O download de arquivos não está disponível.");
  return save(data, "application/json", filename);
}

export class MacroMakerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "macro-maker-app",
    classes: ["macro-maker"],
    position: { width: 1040, height: 800 },
    window: {
      title: "Macro Maker",
      icon: "fas fa-wand-magic-sparkles",
      resizable: true
    },
    actions: {
      new: this.#onNew,
      load: this.#onLoad,
      save: this.#onSave,
      run: this.#onRun,
      duplicate: this.#onDuplicate,
      delete: this.#onDelete,
      "apply-template": this.#onApplyTemplate,
      "filter-templates": this.#onFilterTemplates,
      "save-template": this.#onSaveTemplate,
      export: this.#onExport,
      import: this.#onImport,
      "migrate-all": this.#onMigrateAll,
      "add-step": this.#onAddStep,
      "format-json": this.#onFormatJson,
      "show-tab": this.#onShowTab,
      undo: this.#onUndo,
      redo: this.#onRedo,
      "move-step": this.#onMoveStep,
      "toggle-step": this.#onToggleStep,
      "focus-step": this.#onFocusStep,
      "add-variable": this.#onAddVariable,
      "delete-variable": this.#onDeleteVariable,
      "duplicate-step": this.#onDuplicateStep,
      "delete-step": this.#onDeleteStep,
      "browse-file": this.#onBrowseFile,
      "choose-asset-preset": this.#onChooseAssetPreset,
      "add-part": this.#onAddPart,
      "delete-part": this.#onDeletePart,
      "add-menu-option": this.#onAddMenuOption,
      "delete-menu-option": this.#onDeleteMenuOption,
      "add-branch-step": this.#onAddBranchStep,
      "delete-branch-step": this.#onDeleteBranchStep,
      "add-condition": this.#onAddCondition,
      "delete-condition": this.#onDeleteCondition
    }
  };

  static PARTS = {
    main: {
      template: "modules/macro-maker/templates/macro-maker.hbs",
      scrollable: [".macro-maker-visual", ".macro-maker-json"]
    }
  };

  constructor(options = {}) {
    const { uuid, stepRegistry, ...applicationOptions } = options;
    super(applicationOptions);
    this.stepRegistry = stepRegistry ?? createCoreStepRegistry();
    this.macroUuid = uuid ?? null;
    this.loadedUuid = null;
    this.project = createDefaultProject();
    this.history = new ProjectHistory(this.project);
    this.activeTab = "visual";
    this.lastDebugLog = [];
    this.canEdit = true;
    this.migrationPending = false;
    this.templateSearch = "";
    this.templateCategory = "";
    this.collapsedSteps = new Set();
    this.collapsedProjectUuid = null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (this.macroUuid && this.loadedUuid !== this.macroUuid) {
      const { macro, project, migration } = await ProjectRepository.get(this.macroUuid);
      project.sharing ??= {};
      if (game.user.isGM) project.sharing.folderId ??= macro.folder?.id ?? "";
      this.project = ProjectValidator.normalize(project, { stepRegistry: this.stepRegistry });
      this.canEdit = macro.isOwner;
      this.migrationPending = migration.changed;
      this.loadedUuid = this.macroUuid;
      this.#restoreCollapsedSteps(this.macroUuid);
      this.history.reset(this.project);
    }

    return foundry.utils.mergeObject(context, {
      project: this.project,
      variables: Object.entries(this.project.variables ?? {}).map(([name, value], index) => ({
        name, index, value: typeof value === "object" ? JSON.stringify(value) : String(value),
        valueType: value !== null && ["number", "boolean", "string"].includes(typeof value) ? typeof value : "json"
      })),
      messageFonts: Object.entries(MESSAGE_FONTS).map(([value, label]) => ({ value, label })),
      steps: (this.project.steps ?? []).map((step, index, steps) => ({
        ...step,
        collapsed: this.collapsedSteps.has(step.id),
        displayLabel: step.label || this.stepRegistry.get(step.type)?.label || step.type,
        isRollStep: ["attack", "test", "damage", "healing", "roll"].includes(step.type),
        messageStyle: { font: "inherit", size: 14, align: "left", ...step.messageStyle },
        speakerStyle: { font: "inherit", size: 14, align: "left", ...step.speakerStyle },
        parts: (step.parts ?? []).map((part, partIndex) => ({ ...part, partIndex })),
        options: (step.options ?? []).map((option, optionIndex) => ({ ...option, optionIndex })),
        menuColumns: Array.from({ length: Math.min(6, Math.max(1, Number(step.columns ?? 1))) }, (_value, columnIndex) => {
          const number = columnIndex + 1;
          const settings = step.columnSettings?.[number] ?? {};
          return { number, title: settings.title ?? "", textTransform: settings.textTransform ?? "none" };
        }),
        conditionNodes: (step.conditions ?? []).flatMap((condition, conditionIndex) => flattenConditions(condition, `conditions.${conditionIndex}`)),
        branchConditionNodes: flattenConditions(step.condition, "condition", { deletable: false }),
        thenSteps: (step.then ?? []).map((child, branchIndex) => ({ ...child, branchIndex })),
        elseSteps: (step.else ?? []).map((child, branchIndex) => ({ ...child, branchIndex })),
        index,
        number: index + 1,
        isFirst: index === 0,
        isLast: index === steps.length - 1,
        isEnabled: step.enabled !== false,
        conditionType: step.conditions?.[0]?.type ?? "always",
        rollMode: step.rollMode ?? this.project.rollMode ?? "publicroll",
        hitMode: step.hitMode ?? "auto",
        isAnimation: step.type === "animation",
        isSound: step.type === "sound",
        isWait: step.type === "wait",
        isAttack: step.type === "attack",
        isTest: step.type === "test",
        isDamage: step.type === "damage",
        isHealing: step.type === "healing",
        isRoll: step.type === "roll",
        isMenu: step.type === "menu",
        isBranch: step.type === "branch",
        isSetVariable: step.type === "setVariable",
        isMutateSteps: step.type === "mutateSteps",
        isRemovePersistent: step.type === "removePersistent",
        isAssetPreset: step.type === "assetPreset",
        isSummon: step.type === "summon",
        visageChoices: visageChoices(step.actorId, step.visageId)
      })),
      hasMacro: Boolean(this.macroUuid),
      canManageMacro: Boolean(this.macroUuid) && this.canEdit,
      canEdit: this.canEdit,
      isGM: game.user.isGM,
      summonActors: summonActors(),
      massEditActive: Boolean(game.modules?.get?.("multi-token-edit")?.active),
      visageActive: Boolean(game.modules?.get?.("visage")?.active),
      migrationPending: this.migrationPending,
      folders: folderChoices(game.folders ?? []),
      users: (game.users ?? []).map((user) => ({ id: user.id, name: user.name, active: user.active })),
      templates: game.macroMaker?.templates?.list({ query: this.templateSearch, category: this.templateCategory }) ?? [],
      templateCategories: [...new Set((game.macroMaker?.templates?.list() ?? []).map((template) => template.category))].sort(),
      templateSearch: this.templateSearch,
      templateCategory: this.templateCategory,
      projectJson: JSON.stringify(this.project, null, 2),
      projects: ProjectRepository.list().map((macro) => ({
        uuid: macro.uuid,
        name: macro.name,
        img: macro.img,
        canEdit: macro.isOwner,
        active: macro.uuid === this.macroUuid
      })),
      stepTypes: this.stepRegistry.list().map(({ type, label }) => ({ type, label })),
      debugLog: this.lastDebugLog.map((entry) => ({
        ...entry,
        passed: entry.evaluation?.matched !== false,
        status: entry.evaluation?.matched === false ? "Falhou" : "Passou",
        reason: entry.evaluation?.reason ?? `${entry.kind}: ${entry.action ?? entry.branch ?? entry.variable ?? "executado"}`
      })),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo
    }, { inplace: false });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelectorAll("[data-project-path], [data-step-path], [data-condition-type]")
      .forEach((element) => element.addEventListener("change", (event) => this.#applyControlChange(event)));

    this.element.querySelectorAll("[data-step-index][draggable='true']").forEach((element) => {
      element.addEventListener("dragstart", (event) => this.#dragStart(event));
      element.addEventListener("dragover", (event) => this.#dragOver(event));
      element.addEventListener("dragleave", (event) => event.currentTarget.classList.remove("drag-over"));
      element.addEventListener("drop", (event) => this.#dropStep(event));
    });

    this.#populateSelects();
    this.#enhanceControls();
    this.#updateTargetingControls();
    this.#updateMessagePreviews();
    this.element.querySelectorAll("[data-variable-index]").forEach((element) => {
      element.addEventListener("change", () => this.#changeVariable(element));
    });
    this.element.querySelectorAll("[data-step-position]").forEach((element) => {
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); element.blur(); }
      });
      element.addEventListener("change", () => {
        this.#mutate((project) => moveStepTo(project.steps, Number(element.dataset.stepPosition), Number(element.value) - 1));
        element.value = Number(element.dataset.stepPosition) + 1;
      });
    });
    if (!this.canEdit) {
      this.element.querySelectorAll("[data-project-path], [data-step-path], [data-variable-index], [data-step-position], [data-color-for], [data-action='browse-file'], [data-action='choose-asset-preset'], [data-action='add-variable'], [data-action='delete-variable']")
        .forEach((element) => { element.disabled = true; });
    }
    this.#applyActiveTab();
  }

  static #onNew() { return this.#newProject(); }
  static #onLoad(_event, target) { return this.#loadProject(target); }
  static #onSave() { return this.#save(); }
  static #onRun() { return this.#run(); }
  static #onDuplicate() { return this.#duplicate(); }
  static #onDelete() { return this.#deleteProject(); }
  static #onApplyTemplate(_event, target) { return this.#applyTemplate(target); }
  static #onFilterTemplates() { return this.#filterTemplates(); }
  static #onSaveTemplate() { return this.#saveTemplate(); }
  static #onExport() { return this.#exportProject(); }
  static #onImport() { return this.#importProject(); }
  static #onMigrateAll() { return this.#migrateAll(); }
  static #onAddStep() { return this.#addStep(); }
  static #onFormatJson() { return this.#formatJson(); }
  static #onShowTab(_event, target) { return this.#showTab(target); }
  static #onUndo() { return this.#restoreHistory("undo"); }
  static #onRedo() { return this.#restoreHistory("redo"); }
  static #onMoveStep(_event, target) { return this.#moveStep(target); }
  static #onToggleStep(_event, target) { return this.#toggleStep(target); }
  static #onFocusStep(_event, target) { return this.#focusStep(target); }
  static #onAddVariable() {
    return this.#mutate((project) => {
      project.variables ??= {};
      let number = 1;
      while (Object.hasOwn(project.variables, `VAR_${number}`)) number++;
      project.variables[`VAR_${number}`] = 0;
    });
  }
  static #onDeleteVariable(_event, target) {
    return this.#mutate((project) => {
      const key = Object.keys(project.variables ?? {})[Number(target.dataset.index)];
      if (key !== undefined) delete project.variables[key];
    });
  }
  static #onDuplicateStep(_event, target) { return this.#duplicateStep(target); }
  static #onDeleteStep(_event, target) { return this.#deleteStep(target); }
  static #onBrowseFile(_event, target) { return this.#browseFile(target); }
  static #onChooseAssetPreset(_event, target) { return this.#chooseAssetPreset(target); }
  static #onAddPart(_event, target) { return this.#addPart(target); }
  static #onDeletePart(_event, target) { return this.#deletePart(target); }
  static #onAddMenuOption(_event, target) { return this.#addMenuOption(target); }
  static #onDeleteMenuOption(_event, target) { return this.#deleteMenuOption(target); }
  static #onAddBranchStep(_event, target) { return this.#addBranchStep(target); }
  static #onDeleteBranchStep(_event, target) { return this.#deleteBranchStep(target); }
  static #onAddCondition(_event, target) { return this.#addCondition(target); }
  static #onDeleteCondition(_event, target) { return this.#deleteCondition(target); }

  #query(selector) {
    return this.element?.querySelector(selector) ?? null;
  }

  #editor() {
    return this.#query("textarea[name='projectJson']");
  }

  #readRawEditor() {
    const raw = this.#editor()?.value;
    return raw == null ? clone(this.project) : JSON.parse(raw);
  }

  #readEditor() {
    if (this.#query("[data-variable-invalid]")) throw new Error("Corrija os campos inválidos nas variáveis antes de salvar.");
    return ProjectValidator.normalize(this.#readRawEditor(), { stepRegistry: this.stepRegistry });
  }

  #syncVisualControls() {
    if (!this.element) return;
    const project = this.#readRawEditor();
    for (const element of this.element.querySelectorAll("[data-project-path], [data-step-path], [data-condition-type], [data-condition-node-type], [data-mutation-step-type]")) {
      const index = Number(element.dataset.stepIndex);
      const value = this.#controlValue(element);
      if (element.dataset.conditionType !== undefined) {
        project.steps[index].conditions = value === "always" ? [] : [{ type: value }];
        continue;
      }
      if (element.dataset.conditionNodeType !== undefined) {
        setPath(project.steps[index], element.dataset.stepPath.replace(/\.type$/, ""), value === "group"
          ? { type: "group", operator: "and", children: [{ type: "critical" }] }
          : { type: value });
        continue;
      }
      if (element.dataset.mutationStepType !== undefined) {
        project.steps[index].step = this.stepRegistry.create(value);
        continue;
      }
      if (element.dataset.projectPath) setPath(project, element.dataset.projectPath, value);
      if (element.dataset.stepPath && Number.isInteger(index) && project.steps[index]) {
        setPath(project.steps[index], element.dataset.stepPath, value);
      }
    }
    this.#commit(project);
  }

  #commit(project, { render = false } = {}) {
    this.project = clone(project);
    this.history.commit(this.project);
    const editor = this.#editor();
    if (editor) editor.value = JSON.stringify(this.project, null, 2);
    this.#updateHistoryControls();
    if (render) return this.render();
  }

  #mutate(callback, { render = true } = {}) {
    if (this.macroUuid && !this.canEdit) return ui.notifications.warn("Este projeto está em modo somente leitura.");
    try {
      const project = this.#readRawEditor();
      callback(project);
      return this.#commit(project, { render });
    } catch (error) {
      this.#reportError("alterar o projeto", error);
    }
  }

  async #newProject() {
    this.macroUuid = null;
    this.loadedUuid = null;
    this.project = createDefaultProject();
    this.canEdit = true;
    this.migrationPending = false;
    this.collapsedSteps.clear();
    this.collapsedProjectUuid = null;
    this.history.reset(this.project);
    await this.render();
  }

  async #loadProject(target) {
    this.macroUuid = target.dataset.uuid;
    this.loadedUuid = null;
    await this.render();
  }

  async #save() {
    if (this.macroUuid && !this.canEdit) {
      ui.notifications.warn("Você pode visualizar e executar este projeto, mas não salvá-lo.");
      return false;
    }
    try {
      // Read controls directly so a focused textarea is saved before its blur/change event.
      if (this.activeTab === "visual") this.#syncVisualControls();
      this.#clearValidationErrors();
      const project = this.#readEditor();
      let macro;
      if (this.macroUuid) {
        ({ macro } = await ProjectRepository.get(this.macroUuid));
        await ProjectRepository.update(macro, project);
      } else {
        macro = await ProjectRepository.create(project);
        this.macroUuid = macro.uuid;
      }
      this.project = project;
      this.history.commit(project);
      this.loadedUuid = this.macroUuid;
      this.migrationPending = false;
      await this.#persistCollapsedSteps();
      const slot = Number(project.sharing?.hotbarSlot);
      if (Number.isInteger(slot) && slot >= 1) {
        try {
          await ProjectRepository.assignHotbar(macro, slot);
        } catch (error) {
          ui.notifications.warn(`Projeto salvo, mas a hotbar não foi atualizada: ${error.message}`);
        }
      }
      ui.notifications.info(`Macro Maker: ${project.name} salvo.`);
      await this.render();
      ui["macro-maker"]?.render?.();
      return true;
    } catch (error) {
      this.#showValidationErrors(error);
      this.#reportError("salvar", error);
      return false;
    }
  }

  async #run() {
    if (this.canEdit) {
      if (!await this.#save()) return;
    } else if (!this.macroUuid) return;
    try {
      const context = await game.macroMaker.executeMacro(this.macroUuid);
      this.lastDebugLog = context.debugLog ?? [];
      await this.render();
    } catch (error) {
      console.error("Macro Maker | falha ao executar pela interface", error);
    }
  }

  async #duplicate() {
    if (!this.macroUuid) return ui.notifications.warn("Salve o projeto antes de duplicar.");
    try {
      const { macro } = await ProjectRepository.get(this.macroUuid);
      const userId = game.user.isGM && this.project.sharing?.userId ? this.project.sharing.userId : game.user.id;
      const level = Number(this.project.sharing?.level ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
      const copy = await ProjectRepository.duplicate(macro, { userId, level });
      this.macroUuid = copy.uuid;
      this.loadedUuid = null;
      await this.render();
      ui["macro-maker"]?.render?.();
    } catch (error) {
      this.#reportError("duplicar", error);
    }
  }

  async #deleteProject() {
    if (!this.macroUuid) return;
    try {
      const deleted = await game.macroMaker.deleteProject(this.macroUuid);
      if (!deleted) return;
      await this.#newProject();
      ui["macro-maker"]?.render?.();
    } catch (error) {
      this.#reportError("excluir", error);
    }
  }

  async #applyTemplate(target) {
    try {
      this.project = game.macroMaker.templates.instantiate(target.dataset.templateId);
      this.macroUuid = null;
      this.loadedUuid = null;
      this.canEdit = true;
      this.migrationPending = false;
      this.collapsedSteps.clear();
      this.collapsedProjectUuid = null;
      this.history.reset(this.project);
      await this.render();
    } catch (error) {
      this.#reportError("aplicar o template", error);
    }
  }

  async #filterTemplates() {
    this.templateSearch = this.#query("[name='templateSearch']")?.value ?? "";
    this.templateCategory = this.#query("[name='templateCategory']")?.value ?? "";
    await this.render();
  }

  async #saveTemplate() {
    try {
      const project = this.#readEditor();
      const values = await Dialog.wait({
        title: "Salvar como template",
        content: `<form><label>Nome <input name="name" value="${foundry.utils.escapeHTML(project.name)}"></label><label>Categoria <input name="category" value="Personalizados"></label></form>`,
        buttons: { save: { label: "Salvar", icon: '<i class="fas fa-save"></i>', callback: (html) => {
          const root = html?.[0] ?? html;
          return { name: root.querySelector('[name="name"]').value, category: root.querySelector('[name="category"]').value };
        } } },
        close: () => null
      });
      if (!values) return;
      await game.macroMaker.templates.save(project, values);
      ui.notifications.info("Template salvo.");
      await this.render();
    } catch (error) {
      this.#reportError("salvar o template", error);
    }
  }

  #exportProject() {
    try {
      const project = this.#readEditor();
      const data = game.macroMaker.templates.export(project);
      const filename = `${foundry.utils.slugify?.(project.name) ?? "macro-maker-project"}.macro-maker.json`;
      saveJson(data, filename);
    } catch (error) {
      this.#reportError("exportar", error);
    }
  }

  async #importProject() {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      const file = await new Promise((resolve) => {
        input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
        input.click();
      });
      if (!file) return;
      let preview = await game.macroMaker.templates.previewImport(await file.text());
      const content = preview.missingAssets.length
        ? `<p>Revise os caminhos ausentes antes de importar:</p><form class="macro-maker-import-assets">${preview.missingAssets.map((item) => `<label>${foundry.utils.escapeHTML(item.label ?? item.stepId)}<input data-step-id="${foundry.utils.escapeHTML(item.stepId)}" value="${foundry.utils.escapeHTML(item.file)}"></label>`).join("")}</form>`
        : "<p>Nenhum caminho ausente detectado.</p>";
      const replacements = await Dialog.wait({
        title: `Importar ${foundry.utils.escapeHTML(preview.project.name)}`,
        content: `<p>${preview.project.steps.length} etapa(s), schema ${preview.project.schemaVersion}.</p>${content}`,
        buttons: { import: { label: "Importar", icon: '<i class="fas fa-file-import"></i>', callback: (html) => {
          const root = html?.[0] ?? html;
          return Object.fromEntries([...root.querySelectorAll("[data-step-id]")].map((input) => [input.dataset.stepId, input.value]));
        } } },
        close: () => null
      });
      if (replacements == null) return;
      preview = game.macroMaker.templates.resolveAssets(preview, replacements);
      this.project = game.macroMaker.templates.instantiateImport(preview);
      this.macroUuid = null;
      this.loadedUuid = null;
      this.canEdit = true;
      this.collapsedSteps.clear();
      this.collapsedProjectUuid = null;
      this.history.reset(this.project);
      await this.render();
    } catch (error) {
      this.#reportError("importar", error);
    }
  }

  async #migrateAll() {
    try {
      if (!await Dialog.confirm({ title: "Migrar projetos", content: "<p>Um backup JSON será baixado antes da migração em lote.</p>" })) return;
      const backup = game.macroMaker.migrations.createBackup();
      saveJson(backup, `macro-maker-backup-${Date.now()}.json`);
      const report = await game.macroMaker.migrations.migrateAll();
      ui.notifications.info(`Migração concluída: ${report.success} sucesso(s), ${report.failed} falha(s).`);
      this.loadedUuid = null;
      await this.render();
    } catch (error) {
      this.#reportError("migrar projetos", error);
    }
  }

  #addStep() {
    const type = this.#query("select[name='newStepType']")?.value;
    if (!type) return;
    return this.#mutate((project) => project.steps.push(this.stepRegistry.create(type)));
  }

  #moveStep(target) {
    const index = Number(target.dataset.index);
    const offset = Number(target.dataset.offset);
    return this.#mutate((project) => {
      const destination = index + offset;
      if (destination < 0 || destination >= project.steps.length) return;
      moveStepTo(project.steps, index, destination);
    });
  }

  async #toggleStep(target) {
    const step = this.project.steps[Number(target.dataset.index)];
    if (!step) return;
    if (this.collapsedSteps.has(step.id)) this.collapsedSteps.delete(step.id);
    else this.collapsedSteps.add(step.id);
    const card = target.closest(".macro-maker-step");
    const collapsed = this.collapsedSteps.has(step.id);
    card.querySelector(".macro-maker-step-fields").hidden = collapsed;
    target.setAttribute("aria-expanded", String(!collapsed));
    target.title = collapsed ? "Expandir etapa" : "Minimizar etapa";
    target.querySelector("i").className = "fas fa-chevron-" + (collapsed ? "down" : "up");
    await this.#persistCollapsedSteps();
  }
  #restoreCollapsedSteps(uuid) {
    if (this.collapsedProjectUuid === uuid) return;
    const records = game.settings?.get?.("macro-maker", "collapsedSteps") ?? {};
    const ids = Array.isArray(records?.[uuid]) ? records[uuid] : [];
    this.collapsedSteps = new Set(ids);
    this.collapsedProjectUuid = uuid;
  }

  async #persistCollapsedSteps() {
    if (!this.macroUuid || !game.settings?.get || !game.settings?.set) return;
    const saved = game.settings.get("macro-maker", "collapsedSteps") ?? {};
    const records = foundry.utils.deepClone ? foundry.utils.deepClone(saved) : clone(saved);
    records[this.macroUuid] = [...this.collapsedSteps];
    await game.settings.set("macro-maker", "collapsedSteps", records);
    this.collapsedProjectUuid = this.macroUuid;
  }

  async #focusStep(target) {
    const index = Number(target.dataset.index);
    if (!this.project.steps[index]) return;
    await this.#showTab({ dataset: { tab: "visual" } });
    const card = this.#query(`.macro-maker-step[data-step-index='${index}']`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.querySelector(".step-label")?.focus({ preventScroll: true });
  }

  #changeVariable(element) {
    const row = element.closest(".macro-maker-variable");
    try {
      const entries = Object.entries(this.project.variables ?? {});
      const index = Number(element.dataset.variableIndex);
      const old = entries[index];
      if (!old) return;
      const name = row.querySelector("[data-variable-name]").value.trim();
      // Imported nested variables remain editable; new/renamed names are simple aliases.
      if (name !== old[0]) validateVariableName(name);
      if (entries.some(([key], i) => key === name && i !== index)) throw new Error(`A variável ${name} já existe.`);
      const type = row.querySelector("[data-variable-type]").value;
      const value = parseVariableValue(row.querySelector("[data-variable-value]").value, type);
      this.#mutate((project) => {
        entries[index] = [name, value];
        project.variables = Object.fromEntries(entries);
      }, { render: false });
      delete row.dataset.variableInvalid;
      row.classList.remove("invalid");
      this.#updateMessagePreviews();
    } catch (error) {
      row.dataset.variableInvalid = "true";
      row.classList.add("invalid");
      ui.notifications.warn(error.message);
    }
  }

  #duplicateStep(target) {
    const index = Number(target.dataset.index);
    return this.#mutate((project) => {
      const copy = clone(project.steps[index]);
      copy.id = createId("step");
      copy.label = `${copy.label || copy.type} (cópia)`;
      project.steps.splice(index + 1, 0, copy);
    });
  }

  #deleteStep(target) {
    const index = Number(target.dataset.index);
    return this.#mutate((project) => project.steps.splice(index, 1));
  }

  #addPart(target) {
    const index = Number(target.dataset.index);
    const kind = target.dataset.kind;
    return this.#mutate((project) => {
      const step = project.steps[index];
      step.parts ??= [{
        formula: step.formula ?? (kind === "healing" ? "1d8" : "1d6"),
        type: kind === "healing" ? (step.typeLabel ?? "cura") : (step.damageType ?? ""),
        criticalFormula: step.criticalFormula,
        criticalMultiplier: step.criticalMultiplier
      }];
      step.parts.push({ formula: kind === "healing" ? "1d8" : "1d6", type: "" });
    });
  }

  #deletePart(target) {
    const index = Number(target.dataset.index);
    const partIndex = Number(target.dataset.partIndex);
    return this.#mutate((project) => {
      const parts = project.steps[index]?.parts;
      if (!parts || !Number.isInteger(partIndex)) return;
      parts.splice(partIndex, 1);
      if (!parts.length) delete project.steps[index].parts;
    });
  }

  #addMenuOption(target) {
    const index = Number(target.dataset.index);
    return this.#mutate((project) => {
      project.steps[index].options ??= [];
      project.steps[index].options.push({ label: "Nova opção", value: `option-${project.steps[index].options.length + 1}`, description: "", image: "", icon: "" });
    });
  }

  #deleteMenuOption(target) {
    const index = Number(target.dataset.index);
    const optionIndex = Number(target.dataset.optionIndex);
    return this.#mutate((project) => project.steps[index]?.options?.splice(optionIndex, 1));
  }

  #addBranchStep(target) {
    const index = Number(target.dataset.index);
    const lane = target.dataset.lane;
    const type = this.#query(`[data-branch-step-type='${index}-${lane}']`)?.value;
    if (!type || !["then", "else"].includes(lane)) return;
    return this.#mutate((project) => {
      project.steps[index][lane] ??= [];
      project.steps[index][lane].push(this.stepRegistry.create(type));
    });
  }

  #deleteBranchStep(target) {
    const index = Number(target.dataset.index);
    const branchIndex = Number(target.dataset.branchIndex);
    const lane = target.dataset.lane;
    return this.#mutate((project) => project.steps[index]?.[lane]?.splice(branchIndex, 1));
  }

  #addCondition(target) {
    const index = Number(target.dataset.index);
    const path = target.dataset.path ?? "conditions";
    const type = target.dataset.conditionKind === "group" ? "group" : "critical";
    return this.#mutate((project) => {
      let conditions = getPath(project.steps[index], path);
      if (!Array.isArray(conditions)) {
        setPath(project.steps[index], path, []);
        conditions = getPath(project.steps[index], path);
      }
      conditions.push(type === "group"
        ? { type: "group", operator: "and", children: [{ type: "critical" }] }
        : { type: "critical" });
    });
  }

  #deleteCondition(target) {
    const index = Number(target.dataset.index);
    return this.#mutate((project) => deletePath(project.steps[index], target.dataset.path));
  }

  #formatJson() {
    try {
      const project = this.#readEditor();
      this.#commit(project);
    } catch (error) {
      this.#showValidationErrors(error);
      this.#reportError("formatar o JSON", error);
    }
  }

  async #showTab(target) {
    try {
      const nextTab = target.dataset.tab;
      if (this.activeTab === "visual" && nextTab === "json") this.#syncVisualControls();
      if (this.activeTab === "json" && nextTab !== "json") {
        const project = this.#readEditor();
        this.#commit(project);
        this.activeTab = nextTab;
        await this.render();
        return;
      }
      this.activeTab = nextTab;
      this.#applyActiveTab();
    } catch (error) {
      this.#showValidationErrors(error);
      this.#reportError("alternar o modo do editor", error);
    }
  }

  #applyActiveTab() {
    this.element.querySelectorAll("[data-editor-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.editorPanel !== this.activeTab;
    });
    this.element.querySelectorAll("[data-action='show-tab']").forEach((button) => {
      const active = button.dataset.tab === this.activeTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  #restoreHistory(direction) {
    const project = this.history[direction]();
    if (!project) return;
    this.project = project;
    return this.render();
  }

  #applyControlChange(event) {
    const element = event.currentTarget;
    const index = Number(element.dataset.stepIndex);
    this.#mutate((project) => {
      if (element.dataset.conditionType !== undefined) {
        const type = element.value;
        project.steps[index].conditions = type === "always" ? [] : [{ type }];
        return;
      }
      const value = this.#controlValue(element);
      if (element.dataset.conditionNodeType !== undefined) {
        setPath(project.steps[index], element.dataset.stepPath.replace(/\.type$/, ""), value === "group"
          ? { type: "group", operator: "and", children: [{ type: "critical" }] }
          : { type: value });
        return;
      }
      if (element.dataset.mutationStepType !== undefined) {
        project.steps[index].step = this.stepRegistry.create(value);
        return;
      }
      if (element.dataset.projectPath) setPath(project, element.dataset.projectPath, value);
      if (element.dataset.stepPath) setPath(project.steps[index], element.dataset.stepPath, value);
    }, { render: element.dataset.renderOnChange === "true" });

    if (element.dataset.renderOnChange === "true") return;

    if (element.dataset.projectPath === "name") {
      const heading = this.#query(".macro-maker-toolbar h1");
      if (heading) heading.textContent = element.value || "Projeto sem nome";
    }
    if (element.dataset.stepPath === "enabled") {
      element.closest(".macro-maker-step")?.classList.toggle("disabled", !element.checked);
    }
    if (element.dataset.projectPath?.startsWith("targeting.")) this.#updateTargetingControls();
    if (element.dataset.stepPath === "label") {
      const label = this.#query(`[data-outline-label='${index}']`);
      if (label) label.textContent = element.value || this.project.steps[index].type;
    }
    if (element.dataset.stepPath === "flavor" || element.dataset.stepPath?.startsWith("messageStyle.")) this.#updateMessagePreviews();
    if (["tint", "messageStyle.color", "speakerStyle.color"].includes(element.dataset.stepPath)) {
      const picker = element.closest("label")?.querySelector("[data-color-for]");
      if (picker && /^#[0-9a-f]{6}$/i.test(element.value)) picker.value = element.value;
    }
  }

  #updateTargetingControls() {
    this.element.querySelectorAll("[data-project-path^='targeting.']").forEach((control) => {
      const active = targetingFieldActive(control.dataset.projectPath.split(".").at(-1), this.project.targeting);
      control.disabled = !active || !this.canEdit;
      control.closest("label")?.classList.toggle("macro-maker-inactive-field", !active);
      control.setAttribute("aria-disabled", String(!active || !this.canEdit));
    });
  }

  #enhanceControls() {
    this.element.querySelectorAll("[data-project-path], [data-step-path]").forEach((control) => {
      const path = control.dataset.projectPath ?? control.dataset.stepPath;
      const key = path.split(".").at(-1);
      const label = control.closest("label");
      if (!label) return;
      if (!label.querySelector(".macro-maker-help")) {
        const help = document.createElement("span");
        help.className = "macro-maker-help";
        help.tabIndex = 0;
        help.textContent = "?";
        const fallback = control.tagName === "SELECT"
          ? "Escolha uma das opções disponíveis para este campo."
          : control.type === "checkbox" ? "Marque para ativar esta opção na etapa." : "Preencha este campo conforme a configuração da sua automação.";
        help.title = FIELD_HELP[key] ?? fallback;
        help.setAttribute("aria-label", help.title);
        help.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); });
        label.append(help);
      }
      if (["tint", "messageStyle.color", "speakerStyle.color"].includes(path) && !label.querySelector("[data-color-for]")) {
        const picker = document.createElement("input");
        picker.type = "color";
        picker.dataset.colorFor = path;
        picker.value = /^#[0-9a-f]{6}$/i.test(control.value) ? control.value : "#ffffff";
        picker.setAttribute("aria-label", "Selecionar cor RGB");
        picker.addEventListener("input", () => {
          control.value = picker.value;
          control.dispatchEvent(new Event("change", { bubbles: true }));
        });
        label.insertBefore(picker, control);
      }
    });
  }

  #updateMessagePreviews() {
    this.element.querySelectorAll("[data-message-preview]").forEach((preview) => {
      const step = this.project.steps[Number(preview.dataset.messagePreview)];
      preview.style.cssText = messageStyleCSS(step.messageStyle);
      preview.textContent = interpolate(step.flavor || `${this.project.name} — ${step.label || step.type}`, this.project.variables);
    });
  }

  #controlValue(element) {
    const type = element.dataset.valueType ?? "string";
    if (type === "boolean") return element.checked;
    if (type === "boolean-select") return element.value === "true";
    if (type === "optional-string") return element.value === "" ? DELETE_VALUE : element.value;
    if (["number", "optional-number", "number-null"].includes(type)) {
      if (element.value === "") return type === "number-null" ? null : DELETE_VALUE;
      const value = Number(element.value);
      return Number.isFinite(value) ? value : DELETE_VALUE;
    }
    const text = element.value;
    if (element.dataset.preserveLeadingNewline !== undefined && text.charCodeAt(0) === 0xfeff) {
      return text.slice(1);
    }
    return text;
  }

  #populateSelects() {
    this.element.querySelectorAll("select[data-value]").forEach((element) => {
      element.value = element.dataset.value;
    });
  }

  #updateHistoryControls() {
    const undo = this.#query("[data-action='undo']");
    const redo = this.#query("[data-action='redo']");
    if (undo) undo.disabled = !this.history.canUndo;
    if (redo) redo.disabled = !this.history.canRedo;
  }

  #dragStart(event) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", event.currentTarget.dataset.stepIndex);
  }

  #dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    event.currentTarget.classList.add("drag-over");
  }

  #dropStep(event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");
    const from = Number(event.dataTransfer.getData("text/plain"));
    const to = Number(event.currentTarget.dataset.stepIndex);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
    this.#mutate((project) => {
      moveStepTo(project.steps, from, to);
    });
  }

  #chooseAssetPreset(target) {
    const api = game.modules?.get?.("multi-token-edit")?.api ?? globalThis.MassEdit;
    if (!api?.openPresetBrowser) {
      return ui.notifications.error("Ative Baileywiki Mass Edit para escolher um asset configurado.");
    }
    const index = Number(target.dataset.index);
    const stepId = this.project.steps[index]?.id;
    if (!stepId) return;
    try {
      api.openPresetBrowser({
        documentName: "ALL",
        closeOnPick: true,
        callback: (preset) => this.#mutate((project) => {
          const step = project.steps.find((entry) => entry.id === stepId);
          if (!step) return;
          step.presetUuid = preset?.uuid ?? preset?._id ?? "";
          step.presetName = preset?.name ?? preset?.label ?? "";
          step.presetType = preset?.documentName ?? preset?.type ?? "ALL";
        })
      });
    } catch (error) {
      this.#reportError("abrir o seletor de assets", error);
    }
  }

  #browseFile(target) {
    const index = Number(target.dataset.index);
    const type = target.dataset.fileType ?? "video";
    const FilePickerClass = globalThis.foundry?.applications?.apps?.FilePicker?.implementation
      ?? globalThis.foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker;
    if (!FilePickerClass) return ui.notifications.error("O seletor de arquivos do Foundry não está disponível.");
    const projectPath = target.dataset.projectField;
    const stepPath = target.dataset.stepField ?? "file";
    const stepId = this.project.steps[index]?.id;
    const projectId = this.project.id;
    const current = getPath(projectPath ? this.project : this.project.steps[index], projectPath ?? stepPath) ?? "";
    try {
      const picker = new FilePickerClass({
        type,
        current,
        displayMode: type === "image" ? "thumbs" : "list",
        callback: (path) => this.#mutate((project) => {
          if (project.id !== projectId) throw new Error("O projeto mudou enquanto o seletor estava aberto. Abra o seletor novamente.");
          if (projectPath) setPath(project, projectPath, path);
          else {
            const step = project.steps.find((entry) => entry.id === stepId);
            if (step) setPath(step, stepPath, path);
          }
        })
      });
      Promise.resolve(picker.browse(current))
        .catch((error) => this.#reportError("abrir o seletor de arquivos", error));
    } catch (error) {
      this.#reportError("abrir o seletor de arquivos", error);
    }
  }

  #clearValidationErrors() {
    this.element.querySelectorAll(".invalid").forEach((element) => {
      element.classList.remove("invalid");
      element.removeAttribute("title");
    });
  }

  #showValidationErrors(error) {
    this.#clearValidationErrors();
    if (!(error instanceof ProjectValidationError)) {
      if (error instanceof SyntaxError) {
        const editor = this.#editor();
        editor?.classList.add("invalid");
        if (editor) editor.title = error.message;
      }
      return;
    }
    for (const issue of error.issues) {
      const stepMatch = issue.path.match(/^steps\.(\d+)\.(.+)$/);
      const selector = stepMatch
        ? `[data-step-index='${stepMatch[1]}'][data-step-path='${stepMatch[2]}']`
        : `[data-project-path='${issue.path}']`;
      this.element.querySelectorAll(selector).forEach((element) => {
        element.classList.add("invalid");
        element.title = issue.message;
      });
    }
  }

  #reportError(action, error) {
    console.error(`Macro Maker | falha ao ${action}`, error);
    ui.notifications.error(error.message);
  }
}
