import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { migrateProject } from "../src/migrations/core-migrations.js";
import { ProjectValidator } from "../src/validation/project-validator.js";
import { createCoreStepRegistry } from "../src/execution/core-step-registry.js";

test("o exemplo Sabre Fúngico tem as etapas mínimas", async () => {
  const url = new URL("../examples/sabre-fungico.json", import.meta.url);
  const project = JSON.parse(await readFile(url, "utf8"));
  assert.equal(project.schemaVersion, 1);
  assert.ok(project.steps.some((step) => step.type === "attack"));
  assert.ok(project.steps.some((step) => step.type === "damage"));
  assert.ok(project.steps.some((step) => step.type === "animation"));

  const migrated = migrateProject(project).project;
  const normalized = ProjectValidator.normalize(migrated, { stepRegistry: createCoreStepRegistry() });
  assert.equal(normalized.schemaVersion, 2);
  assert.ok(normalized.steps.every((step) => step.id));
});
