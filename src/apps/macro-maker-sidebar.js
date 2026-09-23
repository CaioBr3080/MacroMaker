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
      run: this.#onRun
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
      }))
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
}
