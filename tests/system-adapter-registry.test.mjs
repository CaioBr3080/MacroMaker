import test from "node:test";
import assert from "node:assert/strict";
import { SystemAdapterRegistry } from "../src/systems/system-adapter-registry.js";

test("registra adaptador e normaliza defesa e resistência", async (t) => {
  globalThis.game = { system: { id: "example" } };
  t.after(() => delete globalThis.game);
  const registry = new SystemAdapterRegistry().register("example", {
    getDefense: async () => "18",
    getResistance: async (_target, type) => type === "fogo" ? "5" : null
  });

  assert.equal(registry.has("example"), true);
  assert.equal(await registry.getDefense({}), 18);
  assert.equal(await registry.getResistance({}, "fogo"), 5);
  assert.equal(await registry.getResistance({}, "frio"), null);
  assert.throws(() => registry.register("example", {}), /Já existe/);
});
