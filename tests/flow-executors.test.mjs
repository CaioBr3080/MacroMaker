import test from "node:test";
import assert from "node:assert/strict";
import { createCoreStepRegistry } from "../src/execution/core-step-registry.js";
import { StepRunner } from "../src/execution/step-runner.js";

test("ramificação executa somente a faixa correspondente", async () => {
  const calls = [];
  const registry = createCoreStepRegistry().register("probe", {
    defaults: {},
    execute: async (step) => calls.push(step.label)
  });
  const context = {
    variables: { poison: "red" },
    branchStack: [],
    enterBranch(step) { this.branchStack.push(step.id); },
    leaveBranch() { this.branchStack.pop(); }
  };
  await registry.execute({
    id: "branch-1",
    type: "branch",
    condition: { type: "menuOption", key: "poison", operator: "eq", value: "red" },
    then: [{ id: "then-1", type: "probe", label: "vermelho" }],
    else: [{ id: "else-1", type: "probe", label: "outro" }]
  }, context);

  assert.deepEqual(calls, ["vermelho"]);
  assert.deepEqual(context.branchStack, []);
});

test("alterações condicionais afetam só a cópia de runtime", async () => {
  const calls = [];
  const registry = createCoreStepRegistry().register("probe", {
    defaults: {},
    execute: async (step) => calls.push(step.label)
  });
  const source = [
    { id: "mutator-1", type: "mutateSteps", action: "modify", targetId: "probe-1", changes: { enabled: false } },
    { id: "probe-1", type: "probe", label: "não deve executar", enabled: true }
  ];
  const runtimeSteps = structuredClone(source);
  const context = { variables: {}, runtimeSteps, stepRegistry: registry };

  await StepRunner.run(runtimeSteps, context, registry);

  assert.deepEqual(calls, []);
  assert.equal(runtimeSteps[1].enabled, false);
  assert.equal(source[1].enabled, true);
});
