import test from "node:test";
import assert from "node:assert/strict";
import { RollExecutor } from "../src/execution/executors/roll-executor.js";
import { messageFlavor, speakerConfig } from "../src/utils/message-style.js";
import { createRollFormulaVariable } from "../src/utils/roll-formula.js";

class MockRoll {
  static messages = [];
  static evaluations = [];

  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
    this.total = formula.includes("1d20") ? 17 : formula.includes("1d8") ? 6 : 4;
    this.dice = formula.includes("1d20")
      ? [{ faces: 20, results: [{ result: 17, active: true }] }]
      : [];
  }

  async evaluate() { MockRoll.evaluations.push(this.formula); this._evaluated = true; return this; }

  static fromTerms([pool]) {
    const roll = new this(`{${pool.rolls.map((part) => part.formula).join(",")}}`);
    roll.total = pool.rolls.reduce((total, part) => total + part.total, 0);
    roll._evaluated = pool.rolls.every((part) => part._evaluated);
    roll.parts = pool.rolls;
    return roll;
  }

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
  MockRoll.evaluations = [];
  globalThis.foundry = { dice: { terms: { PoolTerm: { fromRolls: (rolls) => ({ rolls }) } } } };
  t.after(() => {
    delete globalThis.foundry;
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

  assert.equal(MockRoll.messages.length, 1);
  assert.deepEqual(MockRoll.evaluations, ["2d6", "(1d8) * 2"]);
  assert.equal(MockRoll.messages[0].formula, "{2d6,(1d8) * 2}");
  assert.match(MockRoll.messages[0].data.flavor, /corte/);
  assert.match(MockRoll.messages[0].data.flavor, /fogo/);
  assert.match(MockRoll.messages[0].data.flavor, /Total após resistências: 8/);
  assert.equal(MockRoll.messages[0].data.flags["macro-maker"].parts.length, 2);
  assert.equal(result.parts.length, 2);
  assert.equal(result.total, 8);
  assert.equal(result.parts[1].rawTotal, 6);
  assert.equal(result.parts[1].resistance, 2);
  assert.equal(execution.variables.damage.total, 8);
  assert.equal(execution.lastRoll.total, 10);
  assert.equal(execution.variables.lastRoll.total, 8);
});

test("duas etapas de dano geram duas mensagens e cura agrupa componentes", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.foundry = { dice: { terms: { PoolTerm: { fromRolls: (rolls) => ({ rolls }) } } } };
  t.after(() => { delete globalThis.CONFIG; delete globalThis.ChatMessage; delete globalThis.foundry; });
  MockRoll.messages = [];
  await RollExecutor.damage({ formula: "1d6", damageType: "corte" }, context());
  await RollExecutor.damage({ formula: "1d8", damageType: "fogo" }, context());
  assert.equal(MockRoll.messages.length, 2);
  MockRoll.messages = [];
  const result = await RollExecutor.healing({ parts: [{ formula: "1d6" }, { formula: "1d8" }], rollMode: "blindroll" }, context());
  assert.equal(MockRoll.messages.length, 1);
  assert.equal(MockRoll.messages[0].options.rollMode, "blindroll");
  assert.equal(result.total, 10);
});

test("variáveis numéricas são ligadas às fórmulas e estilos são aplicados ao chat", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  t.after(() => { delete globalThis.CONFIG; delete globalThis.ChatMessage; });
  MockRoll.messages = [];
  const execution = context({ variables: { FOR: 4 } });
  await RollExecutor.generic({ formula: "1d20 + FOR", flavor: "Força {{variables.FOR}}", messageStyle: { bold: true, color: "#ff0000" } }, execution);
  assert.equal(execution.lastRoll.formula, "1d20 + @FOR");
  assert.equal(execution.lastRoll.data.FOR, 4);
  assert.match(MockRoll.messages[0].data.flavor, /font-weight:bold/);
  assert.match(MockRoll.messages[0].data.flavor, /Força 4/);
});

test("o nome do usuário recebe complemento sem perder o alias original", () => {
  assert.deepEqual(speakerConfig({ speakerAppend: "Aldine destrói com sua lâmina", speakerStyle: { bold: true, align: "center" } }, {}), {
    append: "Aldine destrói com sua lâmina",
    css: "white-space:pre-wrap;font-weight:bold;text-align:center"
  });
  assert.equal(messageFlavor({ flavor: "\n\n  Aldine  destrói\ncom sua lâmina\n\n" }, ""),
    '<div style="white-space:pre-wrap">\n\n  Aldine  destrói\ncom sua lâmina\n\n</div>');
});

test("anexa os alvos resolvidos depois da mensagem personalizada", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  t.after(() => { delete globalThis.CONFIG; delete globalThis.ChatMessage; });
  MockRoll.messages = [];
  const execution = context({
    targets: [{ name: "Goblin <1>" }, { document: { name: "Orc" } }]
  });
  await RollExecutor.attack({ formula: "1d20", announceTargets: true }, execution);
  assert.match(MockRoll.messages[0].data.flavor, /Alvos atingidos \(2\):/);
  assert.match(MockRoll.messages[0].data.flavor, /Goblin &lt;1&gt;/);
  assert.match(MockRoll.messages[0].data.flavor, /Orc/);
});
test("variáveis de fórmula funcionam nos campos de acerto e dano", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  MockRoll.messages = [];
  MockRoll.evaluations = [];
  t.after(() => {
    delete globalThis.CONFIG;
    delete globalThis.ChatMessage;
  });
  const execution = context({
    variables: {
      FOR: 4,
      ATAQUE: createRollFormulaVariable("1d20 + FOR"),
      DANO: createRollFormulaVariable("2d6 + @FOR")
    }
  });

  await RollExecutor.attack({ formula: "ATAQUE" }, execution);
  const damage = await RollExecutor.damage({ formula: "@DANO", damageType: "corte" }, execution);

  assert.deepEqual(MockRoll.evaluations, ["(1d20 + @FOR)", "(2d6 + @FOR)"]);
  assert.equal(execution.attack.formula, "(1d20 + @FOR)");
  assert.equal(damage.parts[0].formula, "(2d6 + @FOR)");
});
test("limiar crítico do ataque aceita variável numérica", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  MockRoll.messages = [];
  t.after(() => { delete globalThis.CONFIG; delete globalThis.ChatMessage; });

  const execution = context({ variables: { CRITICO: 17 } });
  const result = await RollExecutor.attack({ formula: "1d20", criticalThreshold: "@CRITICO" }, execution);
  assert.equal(result.critical, true);
  assert.equal(execution.critical, true);
});

test("limiar crítico rejeita variável que não é numérica", async (t) => {
  globalThis.CONFIG = { Dice: { rolls: [MockRoll] } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  t.after(() => { delete globalThis.CONFIG; delete globalThis.ChatMessage; });

  await assert.rejects(
    RollExecutor.attack({ formula: "1d20", criticalThreshold: "CRITICO" }, context({ variables: { CRITICO: "alto" } })),
    /limiar crítico.*variável numérica/i
  );
});