import test from "node:test";
import assert from "node:assert/strict";
import { MassEditAdapter } from "../src/integrations/mass-edit-adapter.js";

test("executa um preset do Mass Edit na posição configurada", async (t) => {
  const calls = [];
  globalThis.game = {
    modules: new Map([["multi-token-edit", {
      active: true,
      api: { async spawnPreset(options) { calls.push(options); return ["created"]; } }
    }]])
  };
  t.after(() => { delete globalThis.game; });

  const result = await MassEditAdapter.spawnPreset({
    presetUuid: "Preset.fire",
    presetType: "Tile",
    destination: "target",
    pickPosition: false,
    snapToGrid: true,
    hidden: true
  }, {
    target: { center: { x: 400, y: 600 } },
    resolveLocation: () => null
  });

  assert.deepEqual(result, ["created"]);
  assert.deepEqual(calls[0], {
    uuid: "Preset.fire",
    name: undefined,
    preview: false,
    snapToGrid: true,
    hidden: true,
    type: "Tile",
    x: 400,
    y: 600
  });
});

test("explica quando o Baileywiki Mass Edit está indisponível", async (t) => {
  globalThis.game = { modules: new Map() };
  t.after(() => { delete globalThis.game; });
  await assert.rejects(
    MassEditAdapter.spawnPreset({ presetName: "Aura" }, {}),
    /Baileywiki Mass Edit/
  );
});