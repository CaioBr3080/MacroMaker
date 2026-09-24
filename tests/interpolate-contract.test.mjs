import test from "node:test";
import assert from "node:assert/strict";
import { interpolate } from "../src/utils/safe-values.js";
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