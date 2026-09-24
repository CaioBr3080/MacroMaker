import test from "node:test";
import assert from "node:assert/strict";
import { folderChoices, targetingFieldActive, moveStepTo, validateVariableName, parseVariableValue } from "../src/apps/editor-controls.js";
import { resolveFormulaVariables } from "../src/utils/formula-variables.js";
import { createRollFormulaVariable } from "../src/utils/roll-formula.js";
import { messageFlavor, messageStyleCSS } from "../src/utils/message-style.js";

test("campos de geometria acompanham o método sem modificar os valores", () => {
  for (const mode of ["currentTargets", "controlled", "token", "point", "circle", "cone", "line", "template", "none"]) {
    const targeting = { mode, source: "controlled", radius: 9, width: 3 };
    assert.equal(targetingFieldActive("radius", targeting), ["circle", "cone"].includes(mode));
    assert.equal(targetingFieldActive("width", targeting), mode === "line");
    assert.equal(targetingFieldActive("angle", targeting), mode === "cone");
    assert.equal(targetingFieldActive("range", targeting), mode !== "none");
    assert.equal(targeting.radius, 9);
  }
  assert.equal(targetingFieldActive("range", { mode: "circle", source: "none" }), false);
  assert.equal(targetingFieldActive("filter", { mode: "point" }), false);
});

test("pastas exibem o caminho completo, ordenam naturalmente e toleram ciclos", () => {
  const folders = [
    { id: "b", name: "Magias 10", type: "Macro", folder: "a" },
    { id: "a", name: "Jogadores", type: "Macro" },
    { id: "c", name: "Magias 2", type: "Macro", folder: { id: "a", name: "Jogadores" } },
    { id: "d", name: "Outro", type: "Actor" },
    { id: "e", name: "Ciclo", type: "Macro", folder: "e" }
  ];
  assert.deepEqual(folderChoices(folders).map((folder) => folder.name), ["Ciclo", "Jogadores", "Jogadores / Magias 2", "Jogadores / Magias 10"]);
});

test("mover pelo número preserva os IDs e rejeita destinos inválidos", () => {
  const steps = [{ id: "a" }, { id: "b" }, { id: "c" }];
  moveStepTo(steps, 0, 2);
  assert.deepEqual(steps.map((step) => step.id), ["b", "c", "a"]);
  assert.throws(() => moveStepTo(steps, 1, -1));
  assert.throws(() => moveStepTo(steps, 0, 1.5));
  assert.deepEqual(steps.map((step) => step.id), ["b", "c", "a"]);
});

test("variáveis são tipadas e nomes inseguros ou reservados são rejeitados", () => {
  assert.equal(validateVariableName("FOR"), "FOR");
  for (const name of ["__proto__", "constructor", "damage", "d20", "a.b", "FOR + 1"]) assert.throws(() => validateVariableName(name));
  assert.equal(parseVariableValue("-4.5", "number"), -4.5);
  assert.equal(parseVariableValue("false", "boolean"), false);
  assert.deepEqual(parseVariableValue("[1,2]", "json"), [1, 2]);
  assert.throws(() => parseVariableValue("", "number"));
  assert.throws(() => parseVariableValue("Infinity", "number"));
  assert.throws(() => parseVariableValue("sim", "boolean"));
});

test("aliases de fórmula preservam dados, anotações, funções e referências explícitas", () => {
  const vars = { FOR: 4, FORTE: 5, floor: 8, d20: 9 };
  assert.equal(resolveFormulaVariables("2d20kh1 + FOR + FORTE + @FOR [FOR]", vars), "2d20kh1 + @FOR + @FORTE + @FOR [FOR]");
  assert.equal(resolveFormulaVariables("floor(FOR / 2) + @damage.total", vars), "floor(@FOR / 2) + @damage.total");
  assert.equal(resolveFormulaVariables("1d6 + FOR", { FOR: -2 }), "1d6 + @FOR");
  assert.throws(() => resolveFormulaVariables("1d6 + FOR", { FOR: "4" }), /numérica/);
  assert.equal(resolveFormulaVariables("1d6 + FOR", { FOR: 9 }), "1d6 + @FOR");
});

test("formatação usa apenas estilos permitidos e escapa o conteúdo formatado", () => {
  const style = { font: "Georgia", size: 18, color: "#aabbcc", bold: true, italic: true, underline: true, align: "center" };
  const html = messageFlavor({ flavor: "FOR {{variables.FOR}}\n<img src=x onerror=alert(1)>", messageStyle: style }, "", { FOR: 4 });
  assert.match(html, /font-family:Georgia/);
  assert.match(html, /font-size:18px/);
  assert.match(html, /FOR 4\n&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.equal(messageStyleCSS({ font: "x;position:fixed", color: "red;display:none", size: 999, bold: "true" }), "white-space:pre-wrap");
  assert.equal(messageFlavor({ flavor: "<b>Legado</b>" }, ""), "<b>Legado</b>");
});

test("fórmulas guardadas em variáveis são expandidas na rolagem do Foundry", () => {
  const variables = {
    FOR: 4,
    ATAQUE: createRollFormulaVariable("1d20 + FOR"),
    DANO: createRollFormulaVariable("2d6 + @FOR")
  };
  assert.deepEqual(parseVariableValue("1d8 + FOR", "formula"), createRollFormulaVariable("1d8 + FOR"));
  assert.equal(resolveFormulaVariables("ATAQUE + DANO", variables), "(1d20 + @FOR) + (2d6 + @FOR)");
  assert.equal(resolveFormulaVariables("@DANO", variables), "(2d6 + @FOR)");
  assert.throws(() => resolveFormulaVariables("TEXTO", { TEXTO: "não numérica" }), /numérica ou uma fórmula/);
});