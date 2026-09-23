import { MODULE_ID, PROJECT_FLAG } from "../constants.js";
import { migrateProject } from "../migrations/core-migrations.js";
import { getPath } from "../utils/safe-values.js";
import { regenerateProjectIds, seedProjectIds } from "../utils/project-ids.js";

function ownershipData(macro) {
  return foundry.utils.deepClone(macro.ownership?.toObject?.() ?? macro.ownership ?? {});
}

function lockedFields(project) {
  const value = project?.sharing?.lockedFields ?? [];
  return (Array.isArray(value) ? value : String(value).split(",")).map((path) => path.trim()).filter(Boolean);
}

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
    if (macro.visible === false) throw new Error("Você não possui permissão para visualizar este projeto.");
    const project = macro.getFlag(MODULE_ID, PROJECT_FLAG);
    if (!project) throw new Error(`Macro Maker: ${uuid} não contém um projeto.`);
    const seeded = seedProjectIds(project, macro.id);
    const identityChanged = JSON.stringify(seeded) !== JSON.stringify(project);
    const migration = migrateProject(seeded);
    migration.changed ||= identityChanged;
    return { macro, project: migration.project, migration };
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
    project.metadata.createdByName ??= game.user.name ?? null;
    project.metadata.createdAt = now;
    project.metadata.updatedAt = now;
    project.metadata.updatedBy = game.user.id;
    const projectOwnership = ownership ?? {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    };
    const assignment = project.sharing?.userId;
    if (assignment) projectOwnership[assignment] = Number(project.sharing?.level ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    folder ??= project.sharing?.folderId || null;

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
    const previous = migrateProject(macro.getFlag(MODULE_ID, PROJECT_FLAG)).project;
    if (!game.user.isGM) {
      for (const path of lockedFields(previous)) {
        if (JSON.stringify(getPath(previous, path)) !== JSON.stringify(getPath(project, path))) {
          throw new Error(`O campo ${path} foi bloqueado pelo GM.`);
        }
      }
      if (JSON.stringify(previous?.sharing) !== JSON.stringify(project?.sharing)) {
        throw new Error("Somente o GM pode alterar compartilhamento, pasta ou campos bloqueados.");
      }
    }
    project.metadata ??= {};
    project.metadata.updatedAt = Date.now();
    project.metadata.updatedBy = game.user.id;
    const update = {
      name: project.name,
      img: project.icon || macro.img,
      command: this.compileCommand(macro.uuid),
      [`flags.${MODULE_ID}.${PROJECT_FLAG}`]: project
    };
    if (game.user.isGM) {
      if (Object.prototype.hasOwnProperty.call(project.sharing ?? {}, "folderId")) {
        update.folder = project.sharing.folderId || null;
      }
      const userId = project.sharing?.userId;
      if (userId) update.ownership = { ...ownershipData(macro), [userId]: Number(project.sharing?.level ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) };
    }
    return macro.update(update);
  }

  static async duplicate(macro, { userId = game.user.id, level = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } = {}) {
    if (!macro.isOwner && !game.user.isGM) throw new Error("Você não pode duplicar este projeto.");
    const project = regenerateProjectIds(macro.getFlag(MODULE_ID, PROJECT_FLAG));
    project.name = `${project.name} (cópia)`;
    project.metadata ??= {};
    project.metadata.createdBy = game.user.id;
    project.metadata.createdAt = Date.now();
    project.metadata.updatedAt = Date.now();
    const ownership = {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      [userId]: level
    };
    return this.create(project, { folder: macro.folder?.id ?? null, ownership });
  }

  static canExecute(macro, project, user = game.user) {
    if (macro.isOwner || user.isGM) return true;
    const observer = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    return project.sharing?.observerCanExecute !== false && macro.testUserPermission?.(user, observer) === true;
  }

  static async assign(uuid, userId, level) {
    if (!game.user.isGM) throw new Error("Somente o GM pode atribuir projetos.");
    const user = game.users.get(userId);
    if (!user) throw new Error("Usuário não encontrado.");
    const { macro } = await this.get(uuid);
    const ownership = { ...ownershipData(macro), [userId]: Number(level) };
    await macro.update({ ownership });
    return macro;
  }

  static async assignHotbar(macro, slot, user = game.user) {
    const number = Number(slot);
    if (!Number.isInteger(number) || number < 1 || number > 50) throw new Error("O slot da hotbar deve estar entre 1 e 50.");
    if (!macro.visible) throw new Error("O usuário não pode acessar este Macro.");
    if (user.id !== game.user.id) throw new Error("A hotbar só pode ser alterada pelo próprio usuário.");
    await user.assignHotbarMacro(macro, number);
  }

  static async delete(macro) {
    if (!macro.isOwner) throw new Error("Você não pode excluir este projeto.");
    await macro.delete();
  }
}
