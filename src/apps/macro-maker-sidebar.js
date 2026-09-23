import { MODULE_ID } from "../constants.js";
import { ProjectRepository } from "../services/project-repository.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

export class MacroMakerSidebar extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = MODULE_ID;

  static DEFAULT_OPTIONS = {
    id: "macro-maker-sidebar",
    classes: ["macro-maker-sidebar-tab"],
    window: {
      title: "Macro Maker",
      icon: "fas fa-wand-magic-sparkles"
    },
    actions: {
      new: this.#onNew,
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
    return foundry.utils.mergeObject(context, {
      projects: ProjectRepository.list().map((macro) => ({
        uuid: macro.uuid,
        name: macro.name,
        img: macro.img,
        canEdit: macro.isOwner
      })),
      isGM: game.user.isGM,
      persistents: game.user.isGM ? game.macroMaker?.persistents?.list?.() ?? [] : []
    }, { inplace: false });
  }

  static #onNew() {
    return game.macroMaker.open();
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
