import test from "node:test";
import assert from "node:assert/strict";
import { PromptVariableExecutor } from "../src/execution/executors/prompt-variable-executor.js";
import { ProjectRepository } from "../src/services/project-repository.js";

test("pede uma resposta tipada e altera apenas a execução por padrão", async (t) => {
  let dialog = null;
  globalThis.Dialog = {
    wait: async (config) => {
      dialog = config;
      return config.buttons.confirm.callback({ querySelector: () => ({ value: "7" }) });
    }
  };
  t.after(() => delete globalThis.Dialog);
  const context = { project: { variables: { FOR: 4 } }, variables: { FOR: 4 }, recordDebug: () => {} };

  const value = await PromptVariableExecutor.execute({
    id: "prompt-1", variable: "FOR", title: "Novo bônus", description: "Valor atual: {FOR}",
    inputLabel: "Bônus", valueType: "number", saveMode: "execution"
  }, context);

  assert.equal(value, 7);
  assert.equal(context.variables.FOR, 7);
  assert.equal(context.project.variables.FOR, 4);
  assert.match(dialog.content, /Valor atual: 4/);
  assert.match(dialog.content, /inputmode="decimal"/);
});

test("pode persistir a resposta no macro quando há permissão de edição", async (t) => {
  globalThis.Dialog = { wait: async (config) => config.buttons.confirm.callback({ querySelector: () => ({ value: "nome novo" }) }) };
  const originalUpdate = ProjectRepository.update;
  let persisted = null;
  ProjectRepository.update = async (macro, project) => { persisted = { macro, project }; };
  t.after(() => { delete globalThis.Dialog; ProjectRepository.update = originalUpdate; });
  const macro = { isOwner: true };
  const context = { macro, project: { variables: { nome: "antigo" } }, variables: { nome: "antigo" }, recordDebug: () => {} };

  await PromptVariableExecutor.execute({
    variable: "nome", valueType: "string", saveMode: "permanent", title: "Nome"
  }, context);

  assert.equal(context.variables.nome, "nome novo");
  assert.equal(context.project.variables.nome, "nome novo");
  assert.equal(persisted.macro, macro);
  assert.equal(persisted.project, context.project);
});

test("cancelar pode manter o valor e continuar", async (t) => {
  globalThis.Dialog = { wait: async () => null };
  t.after(() => delete globalThis.Dialog);
  const context = { project: { variables: { FOR: 4 } }, variables: { FOR: 4 }, cancelled: false, recordDebug: () => {} };

  const result = await PromptVariableExecutor.execute({ variable: "FOR", valueType: "number", cancelBehavior: "continue" }, context);
  assert.equal(result, null);
  assert.equal(context.variables.FOR, 4);
  assert.equal(context.cancelled, false);
});