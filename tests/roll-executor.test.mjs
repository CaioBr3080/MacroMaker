import test from "node:test";
import assert from "node:assert/strict";
import { RollExecutor } from "../src/execution/executors/roll-executor.js";

class MockRoll {
  static messages = [];

  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
    this.total = formula.includes("1d20") ? 17 : formula.includes("1d8") ? 6 : 4;
    this.dice = formula.includes("1d20")
      ? [{ faces: 20, results: [{ result: 17, active: true }] }]
      : [];
  }

  async evaluate() { return this; }

  async toMessage(data, options) {
    MockRoll.messages.push({ formula: this.formula, data, options });
  }
}

function context(overrides = {}) {
  return {
    project: { name: "Projeto" },
    macro: {},
    source: { document: { id: "source" } },
    target: { document: { id: "target" } },
    variables: {},
    rolls: [],
    critical: false,
    systems: null,
    ...overrides
  };
}

test("ataque consulta adaptador de defesa e respeita o modo da mensagem", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: ({ token }) => ({ token: token.id }) };
  MockRoll.messages = [];
  t.after(() => {
    delete globalThis.CONFIG;
    delete globalThis.ChatMessage;
  });
  const execution = context({ systems: { getDefense: async () => 15 } });

  const result = await RollExecutor.attack({
    formula: "1d20 + 4",
    criticalThreshold: 20,
    defenseKey: "ac",
    rollMode: "gmroll"
  }, execution);

  assert.equal(result.hit, true);
  assert.equal(result.defense, 15);
  assert.equal(result.critical, false);
  assert.equal(execution.hit, true);
  assert.equal(MockRoll.messages[0].options.rollMode, "gmroll");
});

test("dano crítico aceita múltiplos componentes e fórmulas alternativas", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  MockRoll.messages = [];
  t.after(() => {
    delete globalThis.CONFIG;
    delete globalThis.ChatMessage;
  });
  const execution = context({
    critical: true,
    systems: { getResistance: async (_target, type) => type === "fogo" ? 2 : null }
  });

  const result = await RollExecutor.damage({
    parts: [
      { formula: "1d6", criticalFormula: "2d6", type: "corte" },
      { formula: "1d8", criticalMultiplier: 2, type: "fogo" }
    ],
    rollMode: "publicroll"
  }, execution);

  assert.deepEqual(MockRoll.messages.map((message) => message.formula), ["2d6", "(1d8) * 2"]);
  assert.equal(result.parts.length, 2);
  assert.equal(result.total, 8);
  assert.equal(result.parts[1].rawTotal, 6);
  assert.equal(result.parts[1].resistance, 2);
  assert.equal(execution.variables.damage.total, 8);
});
