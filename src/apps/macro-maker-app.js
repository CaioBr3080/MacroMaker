import { TARGET_MODES } from "../constants.js";
import { createDefaultProject } from "../data/default-project.js";
import { createCoreStepRegistry } from "../execution/core-step-registry.js";
import { ProjectRepository } from "../services/project-repository.js";
import { ProjectValidationError, ProjectValidator } from "../validation/project-validator.js";
import { ProjectHistory } from "./project-history.js";

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

export class MacroMakerApp extends Application {
  constructor(options = {}) {
    super(options);
    this.stepRegistry = options.stepRegistry ?? createCoreStepRegistry();
    this.macroUuid = options.uuid ?? null;
    this.loadedUuid = null;
    this.project = createDefaultProject();
    this.history = new ProjectHistory(this.project);
    this.activeTab = "visual";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "macro-maker-app",
      title: "Macro Maker",
      template: "modules/macro-maker/templates/macro-maker.hbs",
      classes: ["macro-maker", "sheet"],
      width: 1040,
      height: 800,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  async getData() {
    if (this.macroUuid && this.loadedUuid !== this.macroUuid) {
      const { project } = await ProjectRepository.get(this.macroUuid);
      this.project = ProjectValidator.normalize(project, { stepRegistry: this.stepRegistry });
      this.loadedUuid = this.macroUuid;
      this.history.reset(this.project);
    }

    return {
      project: this.project,
      steps: (this.project.steps ?? []).map((step, index, steps) => ({
        ...step,
        index,
        number: index + 1,
        isFirst: index === 0,
        isLast: index === steps.length - 1,
        isEnabled: step.enabled !== false,
        conditionType: step.conditions?.[0]?.type ?? "always",
        isAnimation: step.type === "animation",
        isSound: step.type === "sound",
        isWait: step.type === "wait",
        isAttack: step.type === "attack",
        isDamage: step.type === "damage",
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
      targetModes: Object.values(TARGET_MODES),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='new']").on("click", () => this.#newProject());
    html.find("[data-action='load']").on("click", (event) => this.#loadProject(event));
    html.find("[data-action='save']").on("click", () => this.#save());
    html.find("[data-action='run']").on("click", () => this.#run());
    html.find("[data-action='duplicate']").on("click", () => this.#duplicate());
    html.find("[data-action='add-step']").on("click", () => this.#addStep());
    html.find("[data-action='format-json']").on("click", () => this.#formatJson());
    html.find("[data-action='show-tab']").on("click", (event) => this.#showTab(event));
    html.find("[data-action='undo']").on("click", () => this.#restoreHistory("undo"));
    html.find("[data-action='redo']").on("click", () => this.#restoreHistory("redo"));
    html.find("[data-action='move-step']").on("click", (event) => this.#moveStep(event));
    html.find("[data-action='duplicate-step']").on("click", (event) => this.#duplicateStep(event));
    html.find("[data-action='delete-step']").on("click", (event) => this.#deleteStep(event));
    html.find("[data-action='browse-file']").on("click", (event) => this.#browseFile(event));
    html.find("[data-project-path], [data-step-path], [data-condition-type]")
      .on("change", (event) => this.#applyControlChange(event));

    html.find("[data-step-index][draggable='true']")
      .on("dragstart", (event) => this.#dragStart(event))
      .on("dragover", (event) => this.#dragOver(event))
      .on("dragleave", (event) => event.currentTarget.classList.remove("drag-over"))
      .on("drop", (event) => this.#dropStep(event));

    this.#populateSelects();
    this.#applyActiveTab();
  }

  #editor() {
    return this.element.find("textarea[name='projectJson']");
  }

  #readRawEditor() {
    const raw = this.#editor().val();
    return raw == null ? clone(this.project) : JSON.parse(raw);
  }

  #readEditor() {
    return ProjectValidator.normalize(this.#readRawEditor(), { stepRegistry: this.stepRegistry });
  }

  #commit(project, { render = false } = {}) {
    this.project = clone(project);
    this.history.commit(this.project);
    this.#editor().val(JSON.stringify(this.project, null, 2));
    this.#updateHistoryControls();
    if (render) this.render(true);
  }

  #mutate(callback, { render = true } = {}) {
    try {
      const project = this.#readRawEditor();
      callback(project);
      this.#commit(project, { render });
    } catch (error) {
      this.#reportError("alterar o projeto", error);
    }
  }

  async #newProject() {
    this.macroUuid = null;
    this.loadedUuid = null;
    this.project = createDefaultProject();
    this.history.reset(this.project);
    await this.render(true);
  }

  async #loadProject(event) {
    this.macroUuid = event.currentTarget.dataset.uuid;
    this.loadedUuid = null;
    await this.render(true);
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
      await this.render(true);
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
      await this.render(true);
    } catch (error) {
      this.#reportError("duplicar", error);
    }
  }

  #addStep() {
    const type = this.element.find("select[name='newStepType']").val();
    this.#mutate((project) => project.steps.push(this.stepRegistry.create(type)));
  }

  #moveStep(event) {
    const index = Number(event.currentTarget.dataset.index);
    const offset = Number(event.currentTarget.dataset.offset);
    this.#mutate((project) => {
      const destination = index + offset;
      if (destination < 0 || destination >= project.steps.length) return;
      const [step] = project.steps.splice(index, 1);
      project.steps.splice(destination, 0, step);
    });
  }

  #duplicateStep(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.#mutate((project) => {
      const copy = clone(project.steps[index]);
      copy.label = `${copy.label || copy.type} (cópia)`;
      project.steps.splice(index + 1, 0, copy);
    });
  }

  #deleteStep(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.#mutate((project) => project.steps.splice(index, 1));
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

  #showTab(event) {
    try {
      if (this.activeTab === "json") {
        const project = this.#readEditor();
        this.#commit(project, { render: true });
      }
      this.activeTab = event.currentTarget.dataset.tab;
      this.#applyActiveTab();
    } catch (error) {
      this.#showValidationErrors(error);
      this.#reportError("alternar o modo do editor", error);
    }
  }

  #applyActiveTab() {
    this.element.find("[data-editor-panel]").attr("hidden", true);
    this.element.find(`[data-editor-panel='${this.activeTab}']`).removeAttr("hidden");
    this.element.find("[data-action='show-tab']").removeClass("active").attr("aria-selected", "false");
    this.element.find(`[data-action='show-tab'][data-tab='${this.activeTab}']`)
      .addClass("active").attr("aria-selected", "true");
  }

  #restoreHistory(direction) {
    const project = this.history[direction]();
    if (!project) return;
    this.project = project;
    this.render(true);
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
      this.element.find(".macro-maker-toolbar h1").text(element.value || "Projeto sem nome");
    }
    if (element.dataset.stepPath === "enabled") {
      element.closest(".macro-maker-step")?.classList.toggle("disabled", !element.checked);
    }
  }

  #controlValue(element) {
    const type = element.dataset.valueType ?? "string";
    if (type === "boolean") return element.checked;
    if (["number", "optional-number", "number-null"].includes(type)) {
      if (element.value === "") return type === "number-null" ? null : DELETE_VALUE;
      const value = Number(element.value);
      return Number.isFinite(value) ? value : DELETE_VALUE;
    }
    return element.value;
  }

  #populateSelects() {
    this.element.find("select[data-value]").each((_index, element) => {
      element.value = element.dataset.value;
    });
  }

  #updateHistoryControls() {
    this.element.find("[data-action='undo']").prop("disabled", !this.history.canUndo);
    this.element.find("[data-action='redo']").prop("disabled", !this.history.canRedo);
  }

  #dragStart(event) {
    event.originalEvent.dataTransfer.effectAllowed = "move";
    event.originalEvent.dataTransfer.setData("text/plain", event.currentTarget.dataset.stepIndex);
  }

  #dragOver(event) {
    event.preventDefault();
    event.originalEvent.dataTransfer.dropEffect = "move";
    event.currentTarget.classList.add("drag-over");
  }

  #dropStep(event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");
    const from = Number(event.originalEvent.dataTransfer.getData("text/plain"));
    let to = Number(event.currentTarget.dataset.stepIndex);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
    this.#mutate((project) => {
      const [step] = project.steps.splice(from, 1);
      project.steps.splice(to, 0, step);
    });
  }

  #browseFile(event) {
    const index = Number(event.currentTarget.dataset.index);
    const type = event.currentTarget.dataset.fileType ?? "video";
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
    this.element.find(".invalid").removeClass("invalid").removeAttr("title");
  }

  #showValidationErrors(error) {
    this.#clearValidationErrors();
    if (!(error instanceof ProjectValidationError)) {
      if (error instanceof SyntaxError) this.#editor().addClass("invalid").attr("title", error.message);
      return;
    }
    for (const issue of error.issues) {
      const stepMatch = issue.path.match(/^steps\.(\d+)\.(.+)$/);
      const selector = stepMatch
        ? `[data-step-index='${stepMatch[1]}'][data-step-path='${stepMatch[2]}']`
        : `[data-project-path='${issue.path}']`;
      this.element.find(selector).addClass("invalid").attr("title", issue.message);
    }
  }

  #reportError(action, error) {
    console.error(`Macro Maker | falha ao ${action}`, error);
    ui.notifications.error(error.message);
  }
}
