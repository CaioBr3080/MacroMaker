import test from "node:test";
import assert from "node:assert/strict";
import { SystemAdapterRegistry } from "../src/systems/system-adapter-registry.js";

test("registra adaptador e normaliza defesa e resistência", async (t) => {
  globalThis.game = { system: { id: "example" } };
  t.after(() => delete globalThis.game);
  const registry = new SystemAdapterRegistry().register("example", {
    getDefense: async () => "18",
    getResistance: async (_target, type) => type === "fogo" ? "5" : null,
    getHpPercent: async () => "37.5",
    hasItem: async (_target, query) => query === "antidote"
  });

  assert.equal(registry.has("example"), true);
  assert.equal(await registry.getDefense({}), 18);
  assert.equal(await registry.getResistance({}, "fogo"), 5);
  assert.equal(await registry.getResistance({}, "frio"), null);
  assert.equal(await registry.getHpPercent({}), 37.5);
  assert.equal(await registry.hasItem({}, "antidote"), true);
  assert.throws(() => registry.register("example", {}), /Já existe/);
});
