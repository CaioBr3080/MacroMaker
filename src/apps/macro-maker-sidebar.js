import { MODULE_ID } from "../constants.js";
import { folderChoices } from "./editor-controls.js";
import { ProjectRepository } from "../services/project-repository.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

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

function sidebarEntries(projects, folders, collapsedFolders = new Set()) {
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
      indent: depth * 14,
      hasChildren,
      collapsed
    });
    if (collapsed) return;
    for (const child of folder.folders.sort(sortByName)) visit(child, depth + 1);
    for (const project of folder.projects.sort(sortByName)) {
      entries.push({ ...project, isProject: true, depth: depth + 1, indent: (depth + 1) * 14 });
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

export class MacroMakerSidebar extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = MODULE_ID;

  static DEFAULT_OPTIONS = {
    id: "{id}",
    classes: ["macro-maker-sidebar-tab"],
    window: {
      title: "Macro Maker",
      icon: "fas fa-wand-magic-sparkles"
    },
    actions: {
      new: this.#onNew,
      "create-folder": this.#onCreateFolder,
      "toggle-folder": this.#onToggleFolder,
      "configure-folder": this.#onConfigureFolder,
      "save-folder": this.#onSaveFolder,
      open: this.#onOpen,
      run: this.#onRun,
      delete: this.#onDelete,
      "end-persistent": this.#onEndPersistent,
      "open-persistent-manager": this.#onOpenPersistentManager
    }
  };

  static PARTS = {
    main: {
      template: "modules/macro-maker/templates/macro-maker-sidebar.hbs",
      scrollable: [".macro-maker-sidebar-projects"]
    }
  };

  editingFolderId = null;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const allFolders = game.folders ?? [];
    const choices = folderChoices(allFolders);
    const projects = ProjectRepository.list().map((macro) => ({
      uuid: macro.uuid,
      name: macro.name,
      img: macro.img,
      canEdit: macro.isOwner,
      folderId: folderId(macro.folder)
    }));
    const collapsedValues = game.settings.get(MODULE_ID, "collapsedFolders") ?? {};
    const collapsedFolders = new Set(
      Object.entries(collapsedValues)
        .filter(([, collapsed]) => collapsed)
        .map(([id]) => id)
    );
    const entries = sidebarEntries(projects, allFolders, collapsedFolders)
      .map((entry) => ({
        ...entry,
        canManageFolder: game.user.isGM,
        editing: game.user.isGM && entry.isFolder && entry.id === this.editingFolderId,
        folderOptions: choices.map((choice) => ({
          ...choice,
          selected: choice.id === entry.parentId
        }))
      }));
    return foundry.utils.mergeObject(context, {
      sidebarEntries: entries,
      folderChoices: choices,
      users: users(),
      isGM: game.user.isGM,
      persistents: game.user.isGM ? game.macroMaker?.persistents?.list?.() ?? [] : []
    }, { inplace: false });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
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

  static #onNew() {
    return game.macroMaker.open();
  }

  static async #onCreateFolder() {
    if (!game.user.isGM) return ui.notifications.warn("Somente o GM pode criar pastas de Macros.");
    const form = this.element?.querySelector?.(".macro-maker-sidebar-folder-create");
    const name = form?.querySelector("[name='folderName']")?.value ?? "";
    if (!name.trim()) return ui.notifications.warn("Informe um nome para a pasta.");

    const parentId = form.querySelector("[name='parentFolderId']")?.value || null;
    const userId = form.querySelector("[name='folderUserId']")?.value || "";
    const level = Number(form.querySelector("[name='folderPermission']")?.value ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    const color = form.querySelector("[name='folderColor']")?.value || "#58729b";
    const ownership = applyOwnership(null, userId, level);

    await Folder.create({
      name: name.trim(),
      type: "Macro",
      folder: parentId,
      color,
      ownership
    });
    form.reset();
    await this.render();
  }

  static async #onToggleFolder(_event, target) {
    const id = target.dataset.folderId;
    if (!id) return;
    const collapsed = game.settings.get(MODULE_ID, "collapsedFolders") ?? {};
    const next = foundry.utils.deepClone(collapsed);
    if (next[id]) delete next[id];
    else next[id] = true;
    await game.settings.set(MODULE_ID, "collapsedFolders", next);
    await this.render();
  }

  static async #onConfigureFolder(_event, target) {
    if (!game.user.isGM) return;
    this.editingFolderId = this.editingFolderId === target.dataset.folderId ? null : target.dataset.folderId;
    await this.render();
  }

  static async #onSaveFolder(_event, target) {
    if (!game.user.isGM) return;
    const form = target.closest(".macro-maker-sidebar-folder-edit");
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