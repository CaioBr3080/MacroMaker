import test from "node:test";
import assert from "node:assert/strict";
import { TokenMagicAdapter } from "../src/integrations/token-magic-adapter.js";

function context(placeable) {
  return {
    resolveLocation: (reference) => reference === "target" ? placeable : null
  };
}

test("aplica preset e filtros JSON no Token Magic FX", async (t) => {
  const calls = [];
  const target = { document: { id: "target" } };
  globalThis.game = { modules: new Map([["tokenmagic", { active: true }]]) };
  globalThis.TokenMagic = {
    async addFilters(...args) { calls.push(["add", ...args]); return "added"; },
    async updateFiltersByPlaceable(...args) { calls.push(["update", ...args]); return "updated"; },
    async deleteFilters(...args) { calls.push(["remove", ...args]); return "removed"; }
  };
  t.after(() => { delete globalThis.game; delete globalThis.TokenMagic; });

  assert.equal(await TokenMagicAdapter.apply({ destination: "target", preset: "fire", replace: true }, context(target)), "added");
  assert.deepEqual(calls[0], ["add", target, "fire", true]);

  assert.equal(await TokenMagicAdapter.apply({
    destination: "target",
    operation: "update",
    filters: '[{"filterId":"aura","outerStrength":8}]'
  }, context(target)), "updated");
  assert.deepEqual(calls[1], ["update", [{ filterId: "aura", outerStrength: 8 }], target]);

  assert.equal(await TokenMagicAdapter.apply({
    destination: "target",
    operation: "remove",
    filterId: "aura"
  }, context(target)), "removed");
  assert.deepEqual(calls[2], ["remove", target, "aura"]);
});

test("informa quando Token Magic FX não está ativo ou falta destino", async (t) => {
  globalThis.game = { modules: new Map() };
  t.after(() => delete globalThis.game);
  await assert.rejects(
    TokenMagicAdapter.apply({ preset: "fire" }, context({ document: { id: "target" } })),
    /Token Magic FX ativo/
  );

  globalThis.game = { modules: new Map([["tokenmagic", { active: true }]]) };
  globalThis.TokenMagic = { addFilters: async () => {} };
  await assert.rejects(
    TokenMagicAdapter.apply({ preset: "fire" }, context(null)),
    /executante, alvo ou template/
  );
  delete globalThis.TokenMagic;
});