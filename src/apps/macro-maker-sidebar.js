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

function sidebarEntries(projects, folders, collapsedFolders = new Set()) {
  const nodes = new Map(
    [...folders]
      .filter((folder) => folder.type === "Macro" && folder.visible !== false)
      .map((folder) => [folder.id, {
        id: folder.id,
        name: folder.name,
        parentId: folderId(folder.folder),
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

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
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
    return foundry.utils.mergeObject(context, {
      sidebarEntries: sidebarEntries(projects, game.folders ?? [], collapsedFolders)
        .map((entry) => ({ ...entry, canManageFolder: game.user.isGM })),
      folderChoices: folderChoices(game.folders ?? []),
      users: users(),
      isGM: game.user.isGM,
      persistents: game.user.isGM ? game.macroMaker?.persistents?.list?.() ?? [] : []
    }, { inplace: false });
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
    const ownership = {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    };

    if (userId === "*") {
      ownership.default = level;
      for (const user of game.users?.contents ?? []) ownership[user.id] = level;
    } else if (userId) {
      ownership[userId] = level;
    }

    await Folder.create({
      name: name.trim(),
      type: "Macro",
      folder: parentId,
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

  static #onConfigureFolder(_event, target) {
    if (!game.user.isGM) return;
    game.folders.get(target.dataset.folderId)?.sheet?.render(true);
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
}
