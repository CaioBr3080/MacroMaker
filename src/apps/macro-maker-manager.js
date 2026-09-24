import { MODULE_ID, PROJECT_FLAG } from "../constants.js";
import { folderChoices, parseVariableValue } from "./editor-controls.js";
import { rollFormulaText } from "../utils/roll-formula.js";
import { ProjectRepository } from "../services/project-repository.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function folderId(value) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function sortByName(left, right) {
  return String(left.name).localeCompare(String(right.name), "pt-BR", { numeric: true });
}

function ownershipData(folder) {
  return foundry.utils.deepClone(folder?.ownership?.toObject?.() ?? folder?.ownership ?? {});
}

function ownershipSummary(folder) {
  const ownership = ownershipData(folder);
  const names = [...(game.users?.contents ?? [])]
    .filter((user) => Number(ownership[user.id] ?? ownership.default ?? 0) >= 2)
    .map((user) => user.name);
  return names.length ? names.join(", ") : "Somente GM";
}

function applyOwnership(folder, userId, level) {
  const ownership = ownershipData(folder);
  ownership.default ??= CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
  ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  if (!userId) return ownership;
  if (userId === "*") {
    ownership.default = level;
    for (const user of game.users?.contents ?? []) ownership[user.id] = level;
  } else ownership[userId] = level;
  return ownership;
}

function wouldCreateCycle(folder, parentId) {
  let current = parentId ? game.folders.get(parentId) : null;
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    if (current.id === folder.id) return true;
    visited.add(current.id);
    current = folderId(current.folder) ? game.folders.get(folderId(current.folder)) : null;
  }
  return false;
}

function managerEntries(projects, folders, collapsedFolders = new Set()) {
  const nodes = new Map(
    [...folders]
      .filter((folder) => folder.type === "Macro" && folder.visible !== false)
      .map((folder) => [folder.id, {
        id: folder.id,
        name: folder.name,
        parentId: folderId(folder.folder),
        color: folder.color || "#58729b",
        ownership: ownershipSummary(folder),
        folders: [],
        projects: []
      }])
  );
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    if (parent && parent !== node) parent.folders.push(node);
    else roots.push(node);
  }

  const rootProjects = [];
  for (const project of projects) {
    const folder = nodes.get(project.folderId);
    if (folder) folder.projects.push(project);
    else rootProjects.push(project);
  }

  const entries = [];
  const visit = (folder, depth) => {
    const hasChildren = folder.folders.length > 0 || folder.projects.length > 0;
    const collapsed = collapsedFolders.has(folder.id);
    entries.push({
      isFolder: true,
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      color: folder.color,
      ownership: folder.ownership,
      depth,
      indent: depth * 18,
      hasChildren,
      collapsed
    });
    if (collapsed) return;
    for (const child of folder.folders.sort(sortByName)) visit(child, depth + 1);
    for (const project of folder.projects.sort(sortByName)) {
      entries.push({ ...project, isProject: true, depth: depth + 1, indent: (depth + 1) * 18 });
    }
  };

  for (const folder of roots.sort(sortByName)) visit(folder, 0);
  for (const project of rootProjects.sort(sortByName)) {
    entries.push({ ...project, isProject: true, depth: 0, indent: 0 });
  }
  return entries;
}

function users() {
  return [...(game.users?.contents ?? [])]
    .map((user) => ({ id: user.id, name: user.name }))
    .sort(sortByName);
}

function variableType(value) {
  if (rollFormulaText(value) !== null) return "formula";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value && typeof value === "object") return "json";
  return "text";
}

function variableValueText(value) {
  const formula = rollFormulaText(value);
  if (formula !== null) return formula;
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function variableTypeOptions(selected) {
  return [
    ["number", "Número"],
    ["text", "Texto"],
    ["boolean", "Booleano"],
    ["json", "JSON"],
    ["formula", "Fórmula"]
  ].map(([value, label]) => ({ value, label, selected: value === selected }));
}

function variableIsLocked(project, name) {
  if (game.user.isGM) return false;
  const locks = project?.sharing?.lockedFields ?? [];
  return (Array.isArray(locks) ? locks : String(locks).split(","))
    .map((path) => path.trim())
    .some((path) => path === "variables" || path === `variables.${name}` || path.startsWith(`variables.${name}.`));
}

function favoriteKey(uuid, name) {
  return `${uuid}::${name}`;
}

function favoriteReference(entry) {
  if (!entry || typeof entry !== "object" || !entry.uuid || !entry.name) return null;
  return { uuid: String(entry.uuid), name: String(entry.name) };
}

function collectFavoriteVariableCandidates(macros) {
  return macros
    .filter((macro) => macro.isOwner)
    .flatMap((macro) => {
      const project = macro.getFlag(MODULE_ID, PROJECT_FLAG);
      return Object.entries(project?.variables ?? {})
        .filter(([name]) => !variableIsLocked(project, name))
        .map(([name, value]) => {
          const type = variableType(value);
          return {
            key: favoriteKey(macro.uuid, name),
            uuid: macro.uuid,
            name,
            macroName: macro.name,
            value: variableValueText(value),
            type,
            typeOptions: variableTypeOptions(type),
            searchText: `${name} ${macro.name}`.toLocaleLowerCase("pt-BR")
          };
        });
    })
    .sort((left, right) => `${left.name} ${left.macroName}`.localeCompare(`${right.name} ${right.macroName}`, "pt-BR", { numeric: true }));
}
export class MacroMakerManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "macro-maker-manager",
    classes: ["macro-maker-manager"],
    window: {
      title: "Macro Maker — Projetos e pastas",
      icon: "fas fa-wand-magic-sparkles",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 860,
      height: 650
    },
    actions: {
      new: this.#onNew,
      "new-folder": this.#onNewFolder,
      "cancel-folder": this.#onCancelFolder,
      "create-folder": this.#onCreateFolder,
      "toggle-folder": this.#onToggleFolder,
      "configure-folder": this.#onConfigureFolder,
      "save-folder": this.#onSaveFolder,
      open: this.#onOpen,
      run: this.#onRun,
      delete: this.#onDelete,
      "end-persistent": this.#onEndPersistent,
      "open-persistent-manager": this.#onOpenPersistentManager,
      "add-favorite-variable": this.#onAddFavoriteVariable,
      "cancel-favorite-variable": this.#onCancelFavoriteVariable,
      "remove-favorite-variable": this.#onRemoveFavoriteVariable,
      "save-favorite-variable": this.#onSaveFavoriteVariable
    }
  };

  static PARTS = {
    main: {
      template: "modules/macro-maker/templates/macro-maker-manager.hbs",
      scrollable: [".macro-maker-manager-tree", ".macro-maker-manager-inspector"]
    }
  };

  static open() {
    const existing = this.instance;
    if (existing?.rendered) {
      existing.bringToFront?.();
      existing.render({ force: true });
      return existing;
    }
    const manager = new this();
    this.instance = manager;
    manager.render({ force: true });
    return manager;
  }

  static refresh() {
    if (this.instance?.rendered) this.instance.render({ force: true });
  }

  editingFolderId = null;
  folderPanel = null;
  addingFavoriteVariable = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const allFolders = game.folders ?? [];
    const choices = folderChoices(allFolders);
    const sourceMacros = ProjectRepository.list();
    const projects = sourceMacros.map((macro) => ({
      uuid: macro.uuid,
      name: macro.name,
      img: macro.img,
      canEdit: macro.isOwner,
      folderId: folderId(macro.folder)
    }));
    const collapsedValues = game.settings?.get?.(MODULE_ID, "collapsedFolders") ?? {};
    const collapsedFolders = new Set(
      Object.entries(collapsedValues)
        .filter(([, collapsed]) => collapsed)
        .map(([id]) => id)
    );
    const entries = managerEntries(projects, allFolders, collapsedFolders);
    const favoriteVariableCandidates = collectFavoriteVariableCandidates(sourceMacros);
    const savedFavorites = (game.settings?.get?.(MODULE_ID, "favoriteVariables") ?? [])
      .map(favoriteReference)
      .filter(Boolean);
    const favoriteKeys = new Set(savedFavorites.map((entry) => favoriteKey(entry.uuid, entry.name)));
    const favoriteVariables = favoriteVariableCandidates.filter((candidate) => favoriteKeys.has(candidate.key));
    const selectedFolder = entries.find((entry) => entry.isFolder && entry.id === this.editingFolderId);
    return foundry.utils.mergeObject(context, {
      managerEntries: entries.map((entry) => ({
        ...entry,
        canManageFolder: game.user.isGM,
        canManageOrganization: game.user.isGM
      })),
      selectedFolder: selectedFolder ? {
        ...selectedFolder,
        folderOptions: choices.map((choice) => ({
          ...choice,
          selected: choice.id === selectedFolder.parentId
        }))
      } : null,
      folderChoices: choices,
      users: users(),
      isGM: game.user.isGM,
      creatingFolder: this.folderPanel === "create",
      editingFolder: this.folderPanel === "edit" && Boolean(selectedFolder),
      persistents: game.user.isGM ? (game.macroMaker?.persistents?.list?.() ?? []) : [],
      favoriteVariables,
      favoriteVariableCandidates,
      addingFavoriteVariable: this.addingFavoriteVariable
    }, { inplace: false });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const favoriteSearch = this.element.querySelector("[data-favorite-variable-search]");
    favoriteSearch?.addEventListener("input", (event) => this.#filterFavoriteCandidates(event.currentTarget.value));
    if (!game.user.isGM) return;
    this.element.querySelectorAll("[data-macro-maker-drag]").forEach((entry) => {
      entry.addEventListener("dragstart", (event) => this.#dragStart(event));
    });
    this.element.querySelectorAll("[data-folder-drop]").forEach((entry) => {
      entry.addEventListener("dragover", (event) => this.#dragOver(event));
      entry.addEventListener("dragleave", (event) => event.currentTarget.classList.remove("drag-over"));
      entry.addEventListener("drop", (event) => this.#dropEntry(event));
    });
  }

  async _onClose(options) {
    await super._onClose(options);
    if (this.constructor.instance === this) this.constructor.instance = null;
  }

  static #onNew() {
    return game.macroMaker.open();
  }

  static async #onNewFolder() {
    if (!game.user.isGM) return;
    this.editingFolderId = null;
    this.folderPanel = "create";
    await this.render();
  }

  static async #onCancelFolder() {
    this.editingFolderId = null;
    this.folderPanel = null;
    await this.render();
  }

  static async #onCreateFolder() {
    if (!game.user.isGM) return ui.notifications.warn("Somente o GM pode criar pastas de Macros.");
    const form = this.element?.querySelector?.(".macro-maker-manager-folder-create");
    const name = form?.querySelector("[name='folderName']")?.value ?? "";
    if (!name.trim()) return ui.notifications.warn("Informe um nome para a pasta.");

    const parentId = form.querySelector("[name='parentFolderId']")?.value || null;
    const userId = form.querySelector("[name='folderUserId']")?.value || "";
    const level = Number(form.querySelector("[name='folderPermission']")?.value ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    const color = form.querySelector("[name='folderColor']")?.value || "#58729b";
    await Folder.create({
      name: name.trim(),
      type: "Macro",
      folder: parentId,
      color,
      ownership: applyOwnership(null, userId, level)
    });
    this.folderPanel = null;
    await this.render();
  }

  static async #onToggleFolder(_event, target) {
    const id = target.dataset.folderId;
    if (!id) return;
    const collapsed = game.settings?.get?.(MODULE_ID, "collapsedFolders") ?? {};
    const next = foundry.utils.deepClone(collapsed);
    if (next[id]) delete next[id];
    else next[id] = true;
    await game.settings.set(MODULE_ID, "collapsedFolders", next);
    await this.render();
  }

  static async #onConfigureFolder(_event, target) {
    if (!game.user.isGM) return;
    this.editingFolderId = target.dataset.folderId;
    this.folderPanel = "edit";
    await this.render();
  }

  static async #onSaveFolder() {
    if (!game.user.isGM) return;
    const form = this.element?.querySelector?.(".macro-maker-manager-folder-edit");
    const folder = game.folders.get(form?.dataset.folderId);
    if (!folder) return;
    const name = form.querySelector("[name='folderName']")?.value?.trim();
    const parentId = form.querySelector("[name='parentFolderId']")?.value || null;
    const color = form.querySelector("[name='folderColor']")?.value || "#58729b";
    const userId = form.querySelector("[name='folderUserId']")?.value || "";
    const level = Number(form.querySelector("[name='folderPermission']")?.value ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    if (!name) return ui.notifications.warn("Informe um nome para a pasta.");
    if (parentId === folder.id || wouldCreateCycle(folder, parentId)) {
      return ui.notifications.warn("Uma pasta não pode ser colocada dentro dela mesma ou de uma subpasta.");
    }
    await folder.update({
      name,
      folder: parentId,
      color,
      ownership: applyOwnership(folder, userId, level)
    });
    this.editingFolderId = null;
    this.folderPanel = null;
    await this.render();
  }

  static #onOpen(_event, target) {
    return game.macroMaker.open(target.dataset.uuid);
  }

  static async #onRun(_event, target) {
    await game.macroMaker.executeMacro(target.dataset.uuid);
  }

  static async #onDelete(_event, target) {
    if (await game.macroMaker.deleteProject(target.dataset.uuid)) await this.render();
  }

  static async #onEndPersistent(_event, target) {
    await game.macroMaker.persistents.end({
      id: target.dataset.effectId,
      name: target.dataset.effectName,
      sceneId: target.dataset.sceneId
    });
    await this.render();
  }

  static #onOpenPersistentManager() {
    return Sequencer.EffectManager.show();
  }

  static async #onAddFavoriteVariable(_event, target) {
    const uuid = target.dataset.uuid;
    const name = target.dataset.variableName;
    if (!uuid || !name) {
      this.addingFavoriteVariable = true;
      return this.render();
    }
    const favorites = (game.settings?.get?.(MODULE_ID, "favoriteVariables") ?? [])
      .map(favoriteReference)
      .filter(Boolean);
    if (favorites.some((entry) => entry.uuid === uuid && entry.name === name)) {
      return ui.notifications.info("Esta variável já está nas suas variáveis frequentes.");
    }
    favorites.push({ uuid, name });
    await game.settings.set(MODULE_ID, "favoriteVariables", favorites);
    this.addingFavoriteVariable = false;
    await this.render();
  }

  static async #onCancelFavoriteVariable() {
    this.addingFavoriteVariable = false;
    await this.render();
  }

  static async #onRemoveFavoriteVariable(_event, target) {
    const uuid = target.dataset.uuid;
    const name = target.dataset.variableName;
    const favorites = (game.settings?.get?.(MODULE_ID, "favoriteVariables") ?? [])
      .map(favoriteReference)
      .filter((entry) => entry && !(entry.uuid === uuid && entry.name === name));
    await game.settings.set(MODULE_ID, "favoriteVariables", favorites);
    await this.render();
  }

  static async #onSaveFavoriteVariable(_event, target) {
    const row = target.closest("[data-favorite-variable]");
    const uuid = row?.dataset.uuid;
    const name = row?.dataset.variableName;
    if (!uuid || !name) return;
    try {
      const { macro, project } = await ProjectRepository.get(uuid);
      if (!macro.isOwner) throw new Error("Você não pode editar este macro.");
      if (!Object.prototype.hasOwnProperty.call(project.variables ?? {}, name)) {
        throw new Error("Esta variável não existe mais neste macro.");
      }
      if (variableIsLocked(project, name)) throw new Error(`A variável ${name} foi bloqueada pelo GM.`);
      const rawValue = row.querySelector("[data-favorite-variable-value]")?.value ?? "";
      const type = row.querySelector("[data-favorite-variable-type]")?.value ?? "text";
      project.variables[name] = parseVariableValue(rawValue, type);
      await ProjectRepository.update(macro, project);
      ui.notifications.info(`Variável ${name} atualizada em ${macro.name}.`);
      await this.render();
    } catch (error) {
      console.error("Macro Maker | falha ao atualizar variável frequente", error);
      ui.notifications.error(error.message ?? "Não foi possível atualizar a variável.");
    }
  }

  #filterFavoriteCandidates(query) {
    const normalized = String(query ?? "").trim().toLocaleLowerCase("pt-BR");
    this.element.querySelectorAll("[data-favorite-variable-candidate]").forEach((entry) => {
      entry.hidden = normalized.length > 0 && !entry.dataset.favoriteSearchText.includes(normalized);
    });
  }

  #dragStart(event) {
    const entry = event.currentTarget;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/macro-maker-entry", JSON.stringify({
      kind: entry.dataset.entryKind,
      id: entry.dataset.entryId
    }));
    event.dataTransfer.setData("text/plain", entry.dataset.entryId);
  }

  #dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    event.currentTarget.classList.add("drag-over");
  }

  async #dropEntry(event) {
    event.preventDefault();
    const destination = event.currentTarget.dataset.folderDrop || null;
    event.currentTarget.classList.remove("drag-over");
    let dragged;
    try {
      dragged = JSON.parse(event.dataTransfer.getData("application/macro-maker-entry"));
    } catch (_error) {
      return;
    }
    if (!dragged?.id || !["folder", "project"].includes(dragged.kind)) return;

    try {
      if (dragged.kind === "folder") {
        const folder = game.folders.get(dragged.id);
        if (!folder || folderId(folder.folder) === destination) return;
        if (destination === folder.id || wouldCreateCycle(folder, destination)) {
          return ui.notifications.warn("Uma pasta não pode ser colocada dentro dela mesma ou de uma subpasta.");
        }
        await folder.update({ folder: destination });
      } else {
        await ProjectRepository.moveToFolder(dragged.id, destination);
      }
      await this.render();
    } catch (error) {
      console.error("Macro Maker | falha ao mover na árvore de pastas", error);
      ui.notifications.error("Não foi possível mover este item: " + error.message);
    }
  }
}