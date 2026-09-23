import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionEvents } from "../src/execution/execution-events.js";
import { StepRunner } from "../src/execution/step-runner.js";
import { StepRegistry } from "../src/execution/step-registry.js";

test("dispara eventos de ataque, acerto e crítico na ordem e executa etapas vinculadas", async (t) => {
  const hooks = [];
  globalThis.Hooks = { callAll: (name) => hooks.push(name) };
  t.after(() => delete globalThis.Hooks);
  const executed = [];
  const context = { hit: null, critical: false };
  const registry = new StepRegistry()
    .register("attack", {
      execute: async (_step, current) => {
        executed.push("attack");
        current.hit = true;
        current.critical = true;
      }
    })
    .register("probe", { execute: async (step) => executed.push(step.label) });
  const steps = [
    { type: "probe", label: "start", event: "onStart" },
    { type: "attack", label: "attack" },
    { type: "probe", label: "hit", event: "onHit" },
    { type: "probe", label: "critical", event: "onCritical" }
  ];
  const events = new ExecutionEvents(steps, context, registry);

  await events.emit("onStart");
  await StepRunner.run(steps, context, registry, { events });

  assert.deepEqual(events.history, ["onStart", "onAttack", "onHit", "onCritical"]);
  assert.deepEqual(executed, ["start", "attack", "hit", "critical"]);
  assert.deepEqual(hooks, [
    "macroMaker.onStart",
    "macroMaker.onAttack",
    "macroMaker.onHit",
    "macroMaker.onCritical"
  ]);
});
