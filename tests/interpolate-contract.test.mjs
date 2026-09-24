import test from "node:test";
import assert from "node:assert/strict";
import { interpolate, interpolateFormula } from "../src/utils/safe-values.js";
import { createRollFormulaVariable } from "../src/utils/roll-formula.js";

test("interpolação curta resolve variáveis em textos sem remover a sintaxe antiga", () => {
  const variables = {
    FOR: 4,
    DT: 15,
    ATAQUE: createRollFormulaVariable("1d20 + @FOR"),
    alvo: { nome: "Cultista" }
  };

  assert.equal(interpolate("Bônus {FOR}; defesa {@DT}; alvo {alvo.nome}", variables), "Bônus 4; defesa 15; alvo Cultista");
  assert.equal(interpolate("Legado {{variables.FOR}} e fórmula {ATAQUE}", variables), "Legado 4 e fórmula 1d20 + @FOR");
  assert.equal(interpolate("Expressão de menu {DT + 5}", variables), "Expressão de menu {DT + 5}");
});
test("fórmulas entre chaves resolvem variáveis repetidas com o Roll do Foundry", async () => {
  const previousRoll = globalThis.Roll;
  const previousConfig = globalThis.CONFIG;
  const formulas = [];
  class TestRoll {
    constructor(formula, data) {
      this.formula = formula;
      this.data = data;
      formulas.push(formula);
    }

    async evaluate() {
      return { total: this.data.FOR + this.data.FOR };
    }
  }

  try {
    globalThis.CONFIG = undefined;
    globalThis.Roll = TestRoll;
    assert.equal(await interpolateFormula("Ataque: {FOR + FOR}", { FOR: 4 }), "Ataque: 8");
    assert.deepEqual(formulas, ["@FOR + @FOR"]);
  } finally {
    if (previousRoll === undefined) delete globalThis.Roll;
    else globalThis.Roll = previousRoll;
    if (previousConfig === undefined) delete globalThis.CONFIG;
    else globalThis.CONFIG = previousConfig;
  }
});
