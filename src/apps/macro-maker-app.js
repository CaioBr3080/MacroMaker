import { createDefaultProject } from "../data/default-project.js";
import { createCoreStepRegistry } from "../execution/core-step-registry.js";
import { ProjectRepository } from "../services/project-repository.js";
import { ProjectValidationError, ProjectValidator } from "../validation/project-validator.js";
import { ProjectHistory } from "./project-history.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DELETE_VALUE = Symbol("delete-value");

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
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
      "add-step": this.#onAddStep,
      "format-json": this.#onFormatJson,
      "show-tab": this.#onShowTab,
      undo: this.#onUndo,
      redo: this.#onRedo,
      "move-step": this.#onMoveStep,
      "duplicate-step": this.#onDuplicateStep,
      "delete-step": this.#onDeleteStep,
      "browse-file": this.#onBrowseFile,
      "add-part": this.#onAddPart,
      "delete-part": this.#onDeletePart
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
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (this.macroUuid && this.loadedUuid !== this.macroUuid) {
      const { project } = await ProjectRepository.get(this.macroUuid);
      this.project = ProjectValidator.normalize(project, { stepRegistry: this.stepRegistry });
      this.loadedUuid = this.macroUuid;
      this.history.reset(this.project);
    }

    return foundry.utils.mergeObject(context, {
      project: this.project,
      steps: (this.project.steps ?? []).map((step, index, steps) => ({
        ...step,
        parts: (step.parts ?? []).map((part, partIndex) => ({ ...part, partIndex })),
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
        isRemovePersistent: step.type === "removePersistent"
      })),
      hasMacro: Boolean(this.macroUuid),
      projectJson: JSON.stringify(this.project, null, 2),
      projects: ProjectRepository.list().map((macro) => ({
        uuid: macro.uuid,
        name: macro.name,
        img: macro.img,
        canEdit: macro.isOwner,
        active: macro.uuid === this.macroUuid
      })),
      stepTypes: this.stepRegistry.list().map(({ type, label }) => ({ type, label })),
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
    this.#applyActiveTab();
  }

  static #onNew() { return this.#newProject(); }
  static #onLoad(_event, target) { return this.#loadProject(target); }
  static #onSave() { return this.#save(); }
  static #onRun() { return this.#run(); }
  static #onDuplicate() { return this.#duplicate(); }
  static #onAddStep() { return this.#addStep(); }
  static #onFormatJson() { return this.#formatJson(); }
  static #onShowTab(_event, target) { return this.#showTab(target); }
  static #onUndo() { return this.#restoreHistory("undo"); }
  static #onRedo() { return this.#restoreHistory("redo"); }
  static #onMoveStep(_event, target) { return this.#moveStep(target); }
  static #onDuplicateStep(_event, target) { return this.#duplicateStep(target); }
  static #onDeleteStep(_event, target) { return this.#deleteStep(target); }
  static #onBrowseFile(_event, target) { return this.#browseFile(target); }
  static #onAddPart(_event, target) { return this.#addPart(target); }
  static #onDeletePart(_event, target) { return this.#deletePart(target); }

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
    return ProjectValidator.normalize(this.#readRawEditor(), { stepRegistry: this.stepRegistry });
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
    this.history.reset(this.project);
    await this.render();
  }

  async #loadProject(target) {
    this.macroUuid = target.dataset.uuid;
    this.loadedUuid = null;
    await this.render();
  }

  async #save() {
    try {
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
    if (!await this.#save()) return;
    try {
      await game.macroMaker.executeMacro(this.macroUuid);
    } catch (error) {
      console.error("Macro Maker | falha ao executar pela interface", error);
    }
  }

  async #duplicate() {
    if (!this.macroUuid) return ui.notifications.warn("Salve o projeto antes de duplicar.");
    try {
      const { macro } = await ProjectRepository.get(this.macroUuid);
      const copy = await ProjectRepository.duplicate(macro);
      this.macroUuid = copy.uuid;
      this.loadedUuid = null;
      await this.render();
      ui["macro-maker"]?.render?.();
    } catch (error) {
      this.#reportError("duplicar", error);
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
      const [step] = project.steps.splice(index, 1);
      project.steps.splice(destination, 0, step);
    });
  }

  #duplicateStep(target) {
    const index = Number(target.dataset.index);
    return this.#mutate((project) => {
      const copy = clone(project.steps[index]);
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
        type: kind === "healing" ? "cura" : (step.damageType ?? "")
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
      if (element.dataset.projectPath) setPath(project, element.dataset.projectPath, value);
      if (element.dataset.stepPath) setPath(project.steps[index], element.dataset.stepPath, value);
    }, { render: false });

    if (element.dataset.projectPath === "name") {
      const heading = this.#query(".macro-maker-toolbar h1");
      if (heading) heading.textContent = element.value || "Projeto sem nome";
    }
    if (element.dataset.stepPath === "enabled") {
      element.closest(".macro-maker-step")?.classList.toggle("disabled", !element.checked);
    }
  }

  #controlValue(element) {
    const type = element.dataset.valueType ?? "string";
    if (type === "boolean") return element.checked;
    if (type === "optional-string") return element.value === "" ? DELETE_VALUE : element.value;
    if (["number", "optional-number", "number-null"].includes(type)) {
      if (element.value === "") return type === "number-null" ? null : DELETE_VALUE;
      const value = Number(element.value);
      return Number.isFinite(value) ? value : DELETE_VALUE;
    }
    return element.value;
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
      const [step] = project.steps.splice(from, 1);
      project.steps.splice(to, 0, step);
    });
  }

  #browseFile(target) {
    const index = Number(target.dataset.index);
    const type = target.dataset.fileType ?? "video";
    const FilePickerClass = globalThis.FilePicker ?? globalThis.foundry?.applications?.apps?.FilePicker;
    if (!FilePickerClass) return ui.notifications.error("O seletor de arquivos do Foundry não está disponível.");
    const current = this.project.steps[index]?.file ?? "";
    try {
      const picker = new FilePickerClass({
        type,
        current,
        callback: (path) => this.#mutate((project) => { project.steps[index].file = path; })
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
