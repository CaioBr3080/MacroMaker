import { ExecutionContext } from "./execution-context.js";
import { StepRunner } from "./step-runner.js";
import { ProjectValidator } from "../validation/project-validator.js";
import { ExecutionEvents } from "./execution-events.js";

export class ProjectExecutor {
  static async execute(project, macro, { stepRegistry, systemRegistry = null } = {}) {
    const normalizedProject = ProjectValidator.normalize(project, { stepRegistry });
    const context = await new ExecutionContext(normalizedProject, macro, { systemRegistry }).initialize();
    if (context.cancelled) {
      Hooks.callAll("macroMaker.cancelExecute", { project: normalizedProject, macro, context });
      return context;
    }
    Hooks.callAll("macroMaker.preExecute", { project: normalizedProject, macro, context });
    const events = new ExecutionEvents(normalizedProject.steps, context, stepRegistry);
    await events.emit("onStart");
    await events.emit("onTarget");
    await StepRunner.run(normalizedProject.steps, context, stepRegistry, { events });
    await events.emit("onEnd");
    context.eventHistory = events.history;
    Hooks.callAll("macroMaker.postExecute", { project: normalizedProject, macro, context });
    return context;
  }
}
