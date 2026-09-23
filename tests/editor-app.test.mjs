import test from "node:test";
import assert from "node:assert/strict";

class Application {
  async _prepareContext() { return {}; }
  async render() { this.renderCount = (this.renderCount ?? 0) + 1; }
}
globalThis.foundry = {
  applications: { api: { ApplicationV2: Application, HandlebarsApplicationMixin: (Base) => Base } },
  utils: { mergeObject: (base, update) => ({ ...structuredClone(base), ...update }), randomID: () => "test-id" }
};
globalThis.game = { user: { id: "gm", isGM: true }, macros: { contents: [] }, users: [], folders: [] };
globalThis.ui = { notifications: { warn() {}, error() {} } };
const { MacroMakerApp } = await import("../src/apps/macro-maker-app.js");

function editor() {
  const app = new MacroMakerApp();
  app.element = { querySelector: () => null, querySelectorAll: () => [] };
  return app;
}
async function action(app, name, dataset, extra = {}) {
  return MacroMakerApp.DEFAULT_OPTIONS.actions[name].call(app, {}, { dataset, ...extra });
}

test("variáveis podem ser criadas, editadas por histórico e removidas", async () => {
  const app = editor();
  await action(app, "add-variable", {});
  assert.deepEqual(app.project.variables, { VAR_1: 0 });
  await action(app, "add-variable", {});
  assert.deepEqual(app.project.variables, { VAR_1: 0, VAR_2: 0 });
  await action(app, "delete-variable", { index: "0" });
  assert.deepEqual(app.project.variables, { VAR_2: 0 });
  await action(app, "undo", {});
  assert.deepEqual(app.project.variables, { VAR_1: 0, VAR_2: 0 });
});

test("adicionar componente preserva crítico da fórmula anterior", async () => {
  const app = editor();
  app.project.steps = [{ id: "damage-1", type: "damage", formula: "1d6 + FOR", damageType: "corte", criticalFormula: "2d6 + FOR", criticalMultiplier: 2 }];
  await action(app, "add-part", { index: "0", kind: "damage" });
  assert.equal(app.project.steps[0].parts[0].criticalFormula, "2d6 + FOR");
  assert.equal(app.project.steps[0].parts[0].criticalMultiplier, 2);
  assert.equal(app.project.steps[0].parts[0].type, "corte");
});

test("imagem do Macro usa FilePicker de imagem e salva no projeto", async () => {
  let options;
  foundry.applications.apps = { FilePicker: class { constructor(input) { options = input; } async browse() {} } };
  const app = editor();
  await action(app, "browse-file", { projectField: "icon", fileType: "image" });
  assert.equal(options.type, "image");
  assert.equal(options.displayMode, "thumbs");
  await options.callback("icons/nova-imagem.webp");
  assert.equal(app.project.icon, "icons/nova-imagem.webp");
});

test("seletor de arquivo acompanha o ID da etapa quando ela muda de posição", async () => {
  let options;
  foundry.applications.apps = { FilePicker: class { constructor(input) { options = input; } async browse() {} } };
  const app = editor();
  app.project.steps = [{ id: "one", file: "one.webm" }, { id: "two", file: "two.webm" }];
  await action(app, "browse-file", { index: "0", fileType: "video" });
  await action(app, "move-step", { index: "0", offset: "1" });
  await options.callback("novo.webm");
  assert.equal(app.project.steps[0].file, "two.webm");
  assert.equal(app.project.steps[1].file, "novo.webm");
});

test("minimizar é estado local ligado ao ID, preservado após reordenar", async () => {
  const app = editor();
  app.project.steps = [{ id: "one", type: "wait" }, { id: "two", type: "wait" }];
  const fields = { hidden: false };
  const icon = {};
  const card = { querySelector: () => fields };
  const button = { closest: () => card, setAttribute() {}, querySelector: () => icon };
  await action(app, "toggle-step", { index: "0" }, button);
  assert.equal(fields.hidden, true);
  assert.equal(app.project.steps[0].collapsed, undefined);
  await action(app, "move-step", { index: "0", offset: "1" });
  const context = await app._prepareContext({});
  assert.equal(context.steps[0].collapsed, false);
  assert.equal(context.steps[1].collapsed, true);
  await action(app, "toggle-step", { index: "1" }, button);
  assert.equal(fields.hidden, false);
});

test("observador não altera variáveis, etapas ou componentes", async () => {
  const app = editor();
  app.macroUuid = "Macro.read-only";
  app.canEdit = false;
  const original = structuredClone(app.project);
  await action(app, "add-variable", {});
  await action(app, "add-part", { index: "0", kind: "damage" });
  assert.deepEqual(app.project, original);
});
