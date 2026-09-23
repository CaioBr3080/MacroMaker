import test from "node:test";
import assert from "node:assert/strict";
import { TargetingService } from "../src/targeting/targeting-service.js";

test("resolve alvos atuais aplicando filtro de relação", async (t) => {
  const source = { id: "source", document: { disposition: 1 } };
  const ally = { id: "ally", document: { disposition: 1 } };
  const enemy = { id: "enemy", document: { disposition: -1 } };
  globalThis.game = { user: { targets: new Set([ally, enemy]) } };
  globalThis.canvas = { tokens: { controlled: [source], placeables: [source, ally, enemy] } };
  t.after(() => {
    delete globalThis.game;
    delete globalThis.canvas;
  });

  const result = await TargetingService.resolve({ mode: "currentTargets", filter: "enemy" }, { source });
  assert.equal(result.cancelled, false);
  assert.deepEqual(result.targets, [enemy]);
});

test("modo sem alvos não exige canvas interativo", async () => {
  const result = await TargetingService.resolve({ mode: "none", filter: "all" });
  assert.deepEqual(result, { cancelled: false, targets: [], location: null, template: null });
});

test("filtro de relação exige um executante", async (t) => {
  globalThis.game = { user: { targets: new Set() } };
  t.after(() => delete globalThis.game);
  await assert.rejects(
    TargetingService.resolve({ mode: "currentTargets", filter: "enemy" }),
    /token executante/
  );
});
