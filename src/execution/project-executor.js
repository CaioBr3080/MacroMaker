import { ExecutionContext } from "./execution-context.js";
import { StepRunner } from "./step-runner.js";
import { ProjectValidator } from "../validation/project-validator.js";

export class ProjectExecutor {
  static async execute(project, macro, { stepRegistry } = {}) {
    const normalizedProject = ProjectValidator.normalize(project, { stepRegistry });
    const context = await new ExecutionContext(normalizedProject, macro).initialize();
    Hooks.callAll("macroMaker.preExecute", { project: normalizedProject, macro, context });
    await StepRunner.run(normalizedProject.steps, context, stepRegistry);
    Hooks.callAll("macroMaker.postExecute", { project: normalizedProject, macro, context });
    return context;
  }
}
