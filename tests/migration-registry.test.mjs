import test from "node:test";
import assert from "node:assert/strict";
import { MigrationRegistry } from "../src/migrations/migration-registry.js";
import { migrateProject } from "../src/migrations/core-migrations.js";
import { MigrationService } from "../src/services/migration-service.js";
import { createCoreStepRegistry } from "../src/execution/core-step-registry.js";

function legacyProject(name = "Legado") {
  return {
    schemaVersion: 1,
    name,
    targeting: { source: "none", mode: "none" },
    variables: {},
    steps: [{ type: "menu", label: "Escolha", variable: "choice", cancelStops: false, options: [{ label: "A", value: "a" }] }]
  };
}

test("registro nunca pula versões e aplica migrações em sequência", () => {
  const registry = new MigrationRegistry()
    .register(1, 2, (project) => ({ ...project, two: true }))
    .register(2, 3, (project) => ({ ...project, three: true }));
  assert.throws(() => new MigrationRegistry().register(1, 3, () => ({})), /exatamente uma versão/);

  const result = registry.migrate({ schemaVersion: 1 }, 3);
  assert.deepEqual(result.applied, [{ from: 1, to: 2 }, { from: 2, to: 3 }]);
  assert.equal(result.project.schemaVersion, 3);
  assert.equal(result.project.three, true);
});

test("migração v1 para v2 adiciona IDs e mantém a fonte intacta", () => {
  const source = legacyProject();
  const result = migrateProject(source);

  assert.equal(source.schemaVersion, 1);
  assert.equal(source.id, undefined);
  assert.equal(result.project.schemaVersion, 2);
  assert.match(result.project.id, /^project-/);
  assert.match(result.project.steps[0].id, /^step-/);
  assert.equal(result.project.steps[0].cancelBehavior, "continue");
});

test("migração em lote cria backup, atualiza comando e não sobrescreve falhas", async (t) => {
  let counter = 0;
  globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => `id${++counter}` } };
  globalThis.game = { user: { isGM: true } };
  t.after(() => { delete globalThis.foundry; delete globalThis.game; });
  const makeMacro = (uuid, source) => ({
    uuid,
    name: uuid,
    command: "antigo",
    source,
    updates: [],
    getFlag: () => source,
    async update(data) { this.updates.push(data); }
  });
  const valid = makeMacro("Macro.valid", legacyProject("Válido"));
  const invalid = makeMacro("Macro.invalid", { ...legacyProject("Inválido"), schemaVersion: 99 });
  const service = new MigrationService(createCoreStepRegistry());

  const report = await service.migrateAll({ macros: [valid, invalid] });

  assert.equal(JSON.parse(report.backup).projects.length, 2);
  assert.equal(report.success, 1);
  assert.equal(report.failed, 1);
  assert.equal(valid.updates.length, 1);
  assert.equal(valid.updates[0].command, 'await game.macroMaker.executeMacro("Macro.valid");');
  assert.equal(invalid.updates.length, 0);
  assert.equal(invalid.source.schemaVersion, 99);
});
