import test from "node:test";
import assert from "node:assert/strict";
import { ProjectTemplateService } from "../src/services/project-template-service.js";
import { createCoreStepRegistry } from "../src/execution/core-step-registry.js";

function installGlobals(t) {
  globalThis.game = { settings: { get: () => [] }, user: { isGM: true } };
  t.after(() => { delete globalThis.game; delete globalThis.Sequencer; });
}

test("galeria contém os nove templates e instâncias não compartilham IDs ou referências", (t) => {
  installGlobals(t);
  const service = new ProjectTemplateService(createCoreStepRegistry());
  assert.equal(service.list().length, 9);
  assert.ok(service.list({ query: "cura" }).some((template) => template.id === "healing"));

  const first = service.instantiate("melee");
  const second = service.instantiate("melee");
  first.steps[0].formula = "99";
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.steps[0].id, second.steps[0].id);
  assert.equal(second.steps[0].formula, "1d20");
});

test("exportar e importar preserva comportamento, mas regenera IDs", async (t) => {
  installGlobals(t);
  const service = new ProjectTemplateService(createCoreStepRegistry());
  const source = service.instantiate("melee");
  const preview = await service.previewImport(service.export(source));
  const imported = service.instantiateImport(preview);

  assert.deepEqual(imported.steps.map((step) => step.type), source.steps.map((step) => step.type));
  assert.equal(imported.steps[0].formula, source.steps[0].formula);
  assert.notEqual(imported.id, source.id);
  assert.notEqual(imported.steps[0].id, source.steps[0].id);
});

test("importação inválida falha antes de criar projeto e lista assets ausentes", async (t) => {
  installGlobals(t);
  globalThis.Sequencer = { Database: { getEntry: async () => null } };
  const service = new ProjectTemplateService(createCoreStepRegistry());

  await assert.rejects(service.previewImport('{"name":'), /JSON de importação inválido/);
  const project = service.instantiate("ranged");
  const missing = await service.findMissingAssets(project);
  assert.ok(missing.some((entry) => entry.file === "jb2a."));
  const resolved = service.resolveAssets({ project, missingAssets: missing }, { [missing[0].stepId]: "jb2a.replacement" });
  assert.ok(resolved.project.steps.some((step) => step.file === "jb2a.replacement"));
});
