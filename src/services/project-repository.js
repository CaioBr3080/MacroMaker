import { MODULE_ID, PROJECT_FLAG } from "../constants.js";

export class ProjectRepository {
  static list() {
    return game.macros.contents
      .filter((macro) => Boolean(macro.getFlag(MODULE_ID, PROJECT_FLAG)))
      .filter((macro) => macro.visible)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  static async get(uuid) {
    const macro = await fromUuid(uuid);
    if (!(macro instanceof Macro)) throw new Error(`Macro Maker: macro não encontrado: ${uuid}`);
    const project = macro.getFlag(MODULE_ID, PROJECT_FLAG);
    if (!project) throw new Error(`Macro Maker: ${uuid} não contém um projeto.`);
    return { macro, project: foundry.utils.deepClone(project) };
  }

  static compileCommand(uuid) {
    return `await game.macroMaker.executeMacro(${JSON.stringify(uuid)});`;
  }

  static async create(project, { folder = null, ownership = null } = {}) {
    if (!game.user.can("MACRO_SCRIPT")) {
      throw new Error("Você não possui permissão para criar macros de script.");
    }

    const now = Date.now();
    project = foundry.utils.deepClone(project);
    project.metadata ??= {};
    project.metadata.createdBy ??= game.user.id;
    project.metadata.createdAt = now;
    project.metadata.updatedAt = now;
    const projectOwnership = ownership ?? {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    };

    const macro = await Macro.create({
      name: project.name,
      type: "script",
      img: project.icon || "icons/svg/dice-target.svg",
      command: "// Macro Maker: preparando projeto...",
      folder,
      ownership: projectOwnership,
      flags: { [MODULE_ID]: { [PROJECT_FLAG]: project } }
    });

    await macro.update({ command: this.compileCommand(macro.uuid) });
    return macro;
  }

  static async update(macro, project) {
    if (!macro.isOwner) throw new Error("Você não pode editar este projeto.");
    project.metadata ??= {};
    project.metadata.updatedAt = Date.now();
    return macro.update({
      name: project.name,
      img: project.icon || macro.img,
      command: this.compileCommand(macro.uuid),
      [`flags.${MODULE_ID}.${PROJECT_FLAG}`]: project
    });
  }

  static async duplicate(macro) {
    const project = foundry.utils.deepClone(macro.getFlag(MODULE_ID, PROJECT_FLAG));
    project.name = `${project.name} (cópia)`;
    project.metadata ??= {};
    project.metadata.createdBy = game.user.id;
    project.metadata.createdAt = Date.now();
    project.metadata.updatedAt = Date.now();
    return this.create(project, { folder: macro.folder?.id ?? null });
  }
}
