import { MODULE_ID } from "../constants.js";
import { ProjectRepository } from "../services/project-repository.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

function folderId(value) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function sortByName(left, right) {
  return String(left.name).localeCompare(String(right.name), "pt-BR", { numeric: true });
}

function sidebarEntries(projects, folders) {
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
    entries.push({ isFolder: true, name: folder.name, depth, indent: depth * 14 });
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
      "new-folder": this.#onNewFolder,
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
    return foundry.utils.mergeObject(context, {
      sidebarEntries: sidebarEntries(projects, game.folders ?? []).map((entry) => ({ ...entry, canManageFolder: game.user.isGM })),
      isGM: game.user.isGM,
      persistents: game.user.isGM ? game.macroMaker?.persistents?.list?.() ?? [] : []
    }, { inplace: false });
  }

  static #onNew() {
    return game.macroMaker.open();
  }

  static async #onNewFolder() {
    if (!game.user.isGM) return ui.notifications.warn("Somente o GM pode criar pastas de Macros.");
    await Folder.createDialog({ type: "Macro" });
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
