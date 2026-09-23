import test from "node:test";
import assert from "node:assert/strict";
import { PersistentEffectService } from "../src/services/persistent-effect-service.js";

test("lista persistentes do módulo, inclusive órfãos, e encerra pelo id", async (t) => {
  const calls = [];
  globalThis.canvas = { scene: { id: "scene-1" } };
  globalThis.Sequencer = {
    EffectManager: {
      getEffects: (filters) => {
        calls.push(["get", filters]);
        return [
          { id: "effect-1", data: { name: "macro-maker.project-1.step-1.aura.fire", sceneId: "scene-1" } },
          { id: "orphan-1", data: { name: "macro-maker.legacy" } }
        ];
      },
      endEffects: async (filters) => calls.push(["end", filters])
    }
  };
  t.after(() => { delete globalThis.canvas; delete globalThis.Sequencer; });
  const service = new PersistentEffectService();

  const effects = service.list();
  assert.equal(effects.length, 2);
  assert.equal(effects[0].orphan, false);
  assert.equal(effects[1].orphan, true);
  await service.end({ id: "effect-1", sceneId: "scene-1" });
  assert.deepEqual(calls.at(-1), ["end", { effects: "effect-1", sceneId: "scene-1" }]);
});
