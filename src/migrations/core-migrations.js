import { SCHEMA_VERSION } from "../constants.js";
import { createId } from "../utils/ids.js";
import { MigrationRegistry } from "./migration-registry.js";

function migrateSteps(steps) {
  for (const step of steps ?? []) {
    step.id ??= createId("step");
    if (step.type === "menu" && step.cancelBehavior == null) {
      step.cancelBehavior = step.cancelStops === false ? "continue" : "abort";
    }
    if (step.type === "animation" && step.duplicatePolicy == null) step.duplicatePolicy = "replace";
    if (step.type === "removePersistent" && step.scope == null) step.scope = step.name ? "name" : (step.object ?? "target");
    migrateSteps(step.then);
    migrateSteps(step.else);
    if (step.step) migrateSteps([step.step]);
  }
}

export const coreMigrations = new MigrationRegistry()
  .register(1, 2, (project) => {
    project.id ??= createId("project");
    project.variables ??= {};
    project.steps ??= [];
    migrateSteps(project.steps);
    project.sharing ??= { observerCanExecute: true, lockedFields: [] };
    return project;
  });

export function migrateProject(project) {
  return coreMigrations.migrate(project, SCHEMA_VERSION);
}
