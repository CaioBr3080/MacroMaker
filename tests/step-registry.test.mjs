import test from "node:test";
import assert from "node:assert/strict";
import { createCoreStepRegistry } from "../src/execution/core-step-registry.js";
import { StepRegistry } from "../src/execution/step-registry.js";
import { StepRunner } from "../src/execution/step-runner.js";

test("registra, instancia e executa um tipo de etapa externo", async () => {
  const calls = [];
  const registry = new StepRegistry().register("example", {
    label: "Exemplo",
    icon: "fas fa-star",
    defaults: { label: "Nova etapa", nested: { value: 1 } },
    schema: { type: "object" },
    execute: async (step, context) => calls.push([step.label, context.id])
  });

  const first = registry.create("example");
  const second = registry.create("example", { label: "Personalizada" });
  first.nested.value = 99;

  assert.equal(registry.has("example"), true);
  assert.equal(second.nested.value, 1);
  assert.equal(second.label, "Personalizada");
  assert.equal(second.type, "example");

  await registry.execute(second, { id: "contexto" });
  assert.deepEqual(calls, [["Personalizada", "contexto"]]);
});

test("impede registro duplicado e definições sem executor", () => {
  const registry = new StepRegistry();
  assert.throws(() => registry.register("invalid", {}), /execute/);
  registry.register("valid", { execute: async () => {} });
  assert.throws(() => registry.register("valid", { execute: async () => {} }), /já está registrado/);
});

test("o registro principal contém todos os tipos do schema v1", () => {
  const types = createCoreStepRegistry().list().map((definition) => definition.type);
  assert.deepEqual(types, [
    "animation",
    "sound",
    "wait",
    "attack",
    "damage",
    "menu",
    "removePersistent"
  ]);
});

test("o runner respeita etapas desabilitadas e acrescenta contexto aos erros", async () => {
  const calls = [];
  const registry = new StepRegistry()
    .register("ok", { execute: async (step) => calls.push(step.label) })
    .register("fail", { execute: async () => { throw new Error("erro original"); } });

  await StepRunner.run([
    { type: "ok", label: "ignorada", enabled: false },
    { type: "ok", label: "executada" }
  ], {}, registry);
  assert.deepEqual(calls, ["executada"]);

  await assert.rejects(
    StepRunner.run([{ type: "fail", label: "Quebrou" }], {}, registry),
    /Falha na etapa 1 \(Quebrou\): erro original/
  );
});
