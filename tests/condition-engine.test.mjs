import test from "node:test";
import assert from "node:assert/strict";
import { ConditionEngine } from "../src/execution/condition-engine.js";

test("avalia grupos AND, OR e NOT aninhados e registra a explicação", async () => {
  const debug = [];
  const context = {
    critical: true,
    hit: false,
    variables: { poison: "purple" },
    targets: [{}, {}],
    recordDebug: (entry) => debug.push(entry)
  };
  const condition = {
    type: "group",
    operator: "and",
    children: [
      { type: "critical" },
      {
        type: "group",
        operator: "or",
        children: [
          { type: "hit" },
          { type: "variable", key: "poison", operator: "eq", value: "purple" }
        ]
      },
      { type: "group", operator: "not", children: [{ type: "targetCount", operator: "lt", value: 2 }] }
    ]
  };

  assert.equal(await ConditionEngine.allMatch([condition], context, { stepId: "step-1" }), true);
  assert.equal(debug.length, 1);
  assert.match(debug[0].evaluation.reason, /AND passou/);
});

test("consulta HP, item, efeito e tag somente através do adapter", async () => {
  const calls = [];
  const context = {
    target: { id: "target" },
    resolveLocation: () => ({ id: "target" }),
    systems: {
      getHpPercent: async () => { calls.push("hp"); return 25; },
      hasItem: async () => { calls.push("item"); return true; },
      hasEffect: async () => { calls.push("effect"); return true; },
      hasTag: async () => { calls.push("tag"); return true; }
    }
  };

  assert.equal(await ConditionEngine.matches({ type: "hpPercent", operator: "lte", value: 50 }, context), true);
  assert.equal(await ConditionEngine.matches({ type: "hasItem", value: "antidote" }, context), true);
  assert.equal(await ConditionEngine.matches({ type: "hasEffect", value: "poisoned" }, context), true);
  assert.equal(await ConditionEngine.matches({ type: "hasTag", value: "boss" }, context), true);
  assert.deepEqual(calls, ["hp", "item", "effect", "tag"]);
});

test("preserva o dado natural do ataque após dano e respeita limites numéricos de crítico", async () => {
  const context = {
    critical: true,
    attack: { dice: [{ faces: 20, results: [{ result: 20, active: true }] }] },
    lastRoll: { dice: [{ faces: 12, results: [{ result: 12, active: true }] }] }
  };

  assert.equal(await ConditionEngine.matches({ type: "naturalDie", operator: "eq", value: 20 }, context), true);
  assert.equal(await ConditionEngine.matches({ type: "critical", operator: "lte", value: 19 }, context), false);
  assert.equal(await ConditionEngine.matches({ type: "critical", operator: "eq", value: 20 }, context), true);

  context.attack = { dice: [{ faces: 20, results: [{ result: 19, active: true }] }] };
  assert.equal(await ConditionEngine.matches({ type: "critical", operator: "lte", value: 19 }, context), true);
});