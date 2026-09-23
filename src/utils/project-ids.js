import { createId } from "./ids.js";
import { clone } from "./safe-values.js";

export function regenerateProjectIds(input) {
  const project = clone(input);
  const replacements = new Map();
  project.id = createId("project");

  const assign = (steps) => {
    for (const step of steps ?? []) {
      const previous = step.id;
      step.id = createId("step");
      if (previous) replacements.set(previous, step.id);
      assign(step.then);
      assign(step.else);
      if (step.step) assign([step.step]);
    }
  };
  const rewrite = (steps) => {
    for (const step of steps ?? []) {
      if (replacements.has(step.targetId)) step.targetId = replacements.get(step.targetId);
      if (replacements.has(step.stepId)) step.stepId = replacements.get(step.stepId);
      rewrite(step.then);
      rewrite(step.else);
      if (step.step) rewrite([step.step]);
    }
  };
  assign(project.steps);
  rewrite(project.steps);
  return project;
}

export function seedProjectIds(input, seed = "legacy") {
  const project = clone(input);
  project.id ??= `project-${seed}`;
  const visit = (steps, prefix = "") => {
    for (const [index, step] of (steps ?? []).entries()) {
      const path = prefix ? `${prefix}_${index}` : String(index);
      step.id ??= `step-${seed}-${path}`;
      visit(step.then, `${path}_then`);
      visit(step.else, `${path}_else`);
      if (step.step) visit([step.step], `${path}_mutation`);
    }
  };
  visit(project.steps);
  return project;
}
