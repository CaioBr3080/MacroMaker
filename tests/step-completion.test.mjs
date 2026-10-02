import test from "node:test";
import assert from "node:assert/strict";
import { StepRunner } from "../src/execution/step-runner.js";
import { StepRegistry } from "../src/execution/step-registry.js";
import { ConditionEngine } from "../src/execution/condition-engine.js";
import { createCoreStepRegistry } from "../src/execution/core-step-registry.js";

test("condição só passa depois da conclusão, inclusive depois de espera", async () => {
  const calls = [];
  const context = { variables: {} };
  const registry = createCoreStepRegistry().register("probe", {
    execute: async (step) => calls.push(step.id)
  });
  const completed = (stepId) => [{ type: "stepCompleted", stepId }];
  await StepRunner.run([
    { id: "too-early", type: "probe", conditions: completed("first-step") },
    { id: "first-step", type: "probe" },
    { id: "disabled", type: "probe", enabled: false },
    { id: "skipped", type: "probe", conditions: [{ type: "hit" }] },
    { id: "wait-step", type: "wait", ms: 1 },
    { id: "after-wait", type: "probe", conditions: completed("first-step") },
    { id: "needs-disabled", type: "probe", conditions: completed("disabled") },
    { id: "needs-skipped", type: "probe", conditions: completed("skipped") }
  ], context, registry);
  assert.deepEqual(calls, ["first-step", "after-wait"]);
  assert.deepEqual([...context.completedStepIds], ["first-step", "wait-step", "after-wait"]);
  assert.equal(await ConditionEngine.matches({ type: "stepCompleted", stepId: "first-step" }, { variables: {} }), false);
});

test("falha e cancelamento não concluem a etapa, nem ela se vê concluída durante execução", async () => {
  for (const action of ["fail", "cancel"]) {
    const context = {};
    const registry = new StepRegistry().register("probe", {
      execute: async (step, ctx) => {
        assert.equal(await ConditionEngine.matches({ type: "stepCompleted", stepId: step.id }, ctx), false);
        if (action === "fail") throw new Error("falhou");
        ctx.cancelled = true;
      }
    });
    const run = StepRunner.run([{ id: "not-done", type: "probe" }], context, registry);
    if (action === "fail") await assert.rejects(run, /falhou/);
    else await run;
    assert.equal(context.completedStepIds?.has("not-done") ?? false, false);
  }
});

test("conclusão fica disponível em eventos e em ramificações aninhadas", async () => {
  const context = { variables: {}, enterBranch() {}, leaveBranch() {} };
  const calls = [];
  const registry = createCoreStepRegistry().register("probe", { execute: async (step) => calls.push(step.id) });
  const completed = (stepId) => ({ type: "stepCompleted", stepId });
  await StepRunner.run([
    { id: "first-step", type: "probe" },
    { id: "branch-step", type: "branch", condition: completed("first-step"), then: [{ id: "child-step", type: "probe" }], else: [] },
    { id: "last-step", type: "probe", conditions: [completed("child-step")] }
  ], context, registry, {
    events: { afterStep: async (step) => assert.equal(await ConditionEngine.matches(completed(step.id), context), true) }
  });
  assert.deepEqual(calls, ["first-step", "child-step", "last-step"]);
  assert.ok(context.completedStepIds.has("branch-step"));
  assert.equal(await ConditionEngine.matches({ type: "group", operator: "not", children: [completed("missing-step")] }, context), true);
});
