import { ExecutionContext } from "./execution-context.js";
import { StepRunner } from "./step-runner.js";
import { ProjectValidator } from "../validation/project-validator.js";
import { ExecutionEvents } from "./execution-events.js";
import { clone } from "../utils/safe-values.js";
import { migrateProject } from "../migrations/core-migrations.js";

function seedLegacyIds(project, macroId) {
  if (!project || typeof project !== "object" || Array.isArray(project)) return project;
  const seeded = clone(project);
  if (!seeded.id && macroId) seeded.id = `project-${macroId}`;
  const visit = (steps, prefix = "") => {
    if (!Array.isArray(steps)) return;
    steps.forEach((step, index) => {
      const path = prefix ? `${prefix}_${index}` : String(index);
      if (step && !step.id && macroId) step.id = `step-${macroId}-${path}`;
      visit(step?.then, `${path}_then`);
      visit(step?.else, `${path}_else`);
      if (step?.step) visit([step.step], `${path}_mutation`);
    });
  };
  visit(seeded.steps);
  return seeded;
}

export class ProjectExecutor {
  static async execute(project, macro, { stepRegistry, systemRegistry = null } = {}) {
    const executionProject = migrateProject(seedLegacyIds(project, macro?.id)).project;
    const normalizedProject = ProjectValidator.normalize(executionProject, { stepRegistry });
    const context = await new ExecutionContext(normalizedProject, macro, { systemRegistry }).initialize();
    if (context.cancelled) {
      Hooks.callAll("macroMaker.cancelExecute", { project: normalizedProject, macro, context });
      return context;
    }
    Hooks.callAll("macroMaker.preExecute", { project: normalizedProject, macro, context });
    const events = new ExecutionEvents(context.runtimeSteps, context, stepRegistry);
    context.runtimeEvents = events;
    context.stepRegistry = stepRegistry;
    await events.emit("onStart");
    if (!context.cancelled) await events.emit("onTarget");
    if (!context.cancelled) await StepRunner.run(context.runtimeSteps, context, stepRegistry, { events });
    if (!context.cancelled) await events.emit("onEnd");
    context.eventHistory = events.history;
    Hooks.callAll("macroMaker.postExecute", { project: normalizedProject, macro, context });
    return context;
  }
}
