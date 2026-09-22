import { createDefaultProject } from "./data/default-project.js";
import { ProjectRepository } from "./services/project-repository.js";
import { ProjectExecutor } from "./execution/project-executor.js";
import { createCoreStepRegistry } from "./execution/core-step-registry.js";
import { ProjectValidator } from "./validation/project-validator.js";

export class MacroMakerAPI {
  constructor(appClass) {
    this.appClass = appClass;
    this.steps = createCoreStepRegistry();
  }

  open(uuid = null) {
    return new this.appClass({ uuid, stepRegistry: this.steps }).render(true);
  }

  createProject(overrides = {}) {
    return ProjectValidator.normalize(createDefaultProject(overrides), { stepRegistry: this.steps });
  }

  async executeMacro(uuid) {
    try {
      const { macro, project } = await ProjectRepository.get(uuid);
      return await ProjectExecutor.execute(project, macro, { stepRegistry: this.steps });
    } catch (error) {
      console.error("Macro Maker | falha na execução", error);
      ui.notifications.error(error.message);
      throw error;
    }
  }
}
