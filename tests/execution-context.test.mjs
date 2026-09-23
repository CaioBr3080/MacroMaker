import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionContext } from "../src/execution/execution-context.js";

function installGlobals(t, distance = 6) {
  const source = { id: "source", center: { x: 0, y: 0 } };
  globalThis.foundry = {
    utils: {
      deepClone: (value) => structuredClone(value),
      randomID: () => "execution-id"
    }
  };
  globalThis.canvas = {
    tokens: { controlled: [source] },
    grid: { measurePath: () => ({ distance }) }
  };
  t.after(() => {
    delete globalThis.foundry;
    delete globalThis.canvas;
  });
  return source;
}

function project(range) {
  return {
    name: "Teste",
    variables: {},
    targeting: {
      source: "controlled",
      mode: "currentTargets",
      minTargets: 0,
      maxTargets: 1,
      range,
      blockOutOfRange: true
    }
  };
}

test("sem alvos ignora contagens inativas preservadas de outro método", async (t) => {
  installGlobals(t);
  const source = project(5);
  source.targeting.mode = "none";
  source.targeting.minTargets = 3;
  source.targeting.maxTargets = 5;
  const execution = await new ExecutionContext(source, {}, {
    targetingService: { resolve: async () => ({ targets: [], location: null, template: null }) }
  }).initialize();
  assert.equal(execution.targets.length, 0);
  assert.equal(source.targeting.minTargets, 3);
});

test("alcance nulo não é interpretado como zero", async (t) => {
  installGlobals(t);
  const target = { id: "target", center: { x: 10, y: 0 } };
  const targetingService = {
    resolve: async () => ({ cancelled: false, targets: [target], location: null, template: null })
  };

  const context = await new ExecutionContext(project(null), {}, { targetingService }).initialize();
  assert.equal(context.distanceTo(), 6);
  assert.equal(context.executionId, "execution-id");
});

test("valida o alcance de todos os alvos", async (t) => {
  installGlobals(t, 6);
  const target = { id: "target", center: { x: 10, y: 0 } };
  const targetingService = {
    resolve: async () => ({ cancelled: false, targets: [target], location: null, template: null })
  };

  await assert.rejects(
    new ExecutionContext(project(5), {}, { targetingService }).initialize(),
    /fora do alcance/
  );
});

test("um ponto escolhido satisfaz o mínimo de uma seleção", async (t) => {
  installGlobals(t, 3);
  const pointProject = project(5);
  pointProject.targeting.mode = "point";
  pointProject.targeting.minTargets = 1;
  const targetingService = {
    resolve: async () => ({
      cancelled: false,
      targets: [],
      location: { x: 4, y: 0 },
      template: null
    })
  };

  const context = await new ExecutionContext(pointProject, {}, { targetingService }).initialize();
  assert.deepEqual(context.location, { x: 4, y: 0 });
});
