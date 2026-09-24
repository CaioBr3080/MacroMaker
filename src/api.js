import { createDefaultProject } from "./data/default-project.js";
import { ProjectRepository } from "./services/project-repository.js";
import { ProjectExecutor } from "./execution/project-executor.js";
import { createCoreStepRegistry } from "./execution/core-step-registry.js";
import { ProjectValidator } from "./validation/project-validator.js";
import { SystemAdapterRegistry } from "./systems/system-adapter-registry.js";
import { PersistentEffectService } from "./services/persistent-effect-service.js";
import { ConditionEngine } from "./execution/condition-engine.js";
import { MigrationService } from "./services/migration-service.js";
import { ProjectTemplateService } from "./services/project-template-service.js";
import { CompatibilityService } from "./services/compatibility-service.js";

export class MacroMakerAPI {
  constructor(appClass, managerClass = null) {
    this.appClass = appClass;
    this.managerClass = managerClass;
    this.steps = createCoreStepRegistry();
    this.systems = new SystemAdapterRegistry();
    this.persistents = new PersistentEffectService();
    this.migrations = new MigrationService(this.steps);
    this.templates = new ProjectTemplateService(this.steps);
    this.compatibility = new CompatibilityService();
    this.conditions = Object.freeze({
      evaluate: (condition, context) => ConditionEngine.evaluate(condition, context)
    });
  }

  open(uuid = null) {
    return new this.appClass({ uuid, stepRegistry: this.steps }).render({ force: true });
  }

  openManager() {
    return this.managerClass?.open?.();
  }

  createProject(overrides = {}) {
    return ProjectValidator.normalize(createDefaultProject(overrides), { stepRegistry: this.steps });
  }

  async executeMacro(uuid) {
    try {
      const { macro, project } = await ProjectRepository.get(uuid);
      if (!ProjectRepository.canExecute(macro, project)) {
        throw new Error("Você não possui permissão para executar este projeto.");
      }
      return await ProjectExecutor.execute(project, macro, {
        stepRegistry: this.steps,
        systemRegistry: this.systems
      });
    } catch (error) {
      console.error("Macro Maker | falha na execução", error);
      ui.notifications.error(error.message);
      throw error;
    }
  }

  async assign(uuid, userId, level = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) {
    return ProjectRepository.assign(uuid, userId, level);
  }

  async duplicateForUser(uuid, userId, level = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
    if (!game.user.isGM) throw new Error("Somente o GM pode duplicar um projeto para outro usuário.");
    const { macro } = await ProjectRepository.get(uuid);
    return ProjectRepository.duplicate(macro, { userId, level });
  }

  async deleteProject(uuid, { confirm = true } = {}) {
    const { macro } = await ProjectRepository.get(uuid);
    if (confirm) {
      const accepted = await Dialog.confirm({
        title: "Excluir projeto",
        content: `<p>Excluir permanentemente <strong>${foundry.utils.escapeHTML(macro.name)}</strong>?</p>`
      });
      if (!accepted) return false;
    }
    await ProjectRepository.delete(macro);
    return true;
  }
}
