import test from "node:test";
import assert from "node:assert/strict";
import { RollAnalysis } from "../src/execution/roll-analysis.js";

test("considera somente resultados naturais ativos do dado configurado", () => {
  const roll = {
    formula: "4d20kh + 15",
    total: 24,
    dice: [
      { faces: 20, results: [
        { result: 20, active: false },
        { result: 17, active: true },
        { result: 12, active: false },
        { result: 5, active: false }
      ] },
      { faces: 6, results: [{ result: 6, active: true }] }
    ]
  };
  assert.deepEqual(RollAnalysis.activeNaturalResults(roll), [17]);
  assert.equal(RollAnalysis.isCritical(roll, { criticalThreshold: 20 }), false);
  assert.equal(RollAnalysis.isCritical(roll, { criticalThreshold: 17 }), true);
});

test("detecta crítico por margem e monta fórmula multiplicada", () => {
  const roll = { total: 27, dice: [] };
  assert.equal(RollAnalysis.isCritical(roll, { criticalMargin: 7 }, { defense: 20 }), true);
  assert.equal(RollAnalysis.isCritical(roll, { criticalMargin: 8 }, { defense: 20 }), false);
  assert.equal(RollAnalysis.criticalFormula({ criticalMultiplier: 2 }, "2d6 + 3"), "(2d6 + 3) * 2");
  assert.equal(RollAnalysis.criticalFormula({ criticalFormula: "4d6 + 3" }, "2d6 + 3"), "4d6 + 3");
});
