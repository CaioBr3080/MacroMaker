import test from "node:test";
import assert from "node:assert/strict";
import { VisageExecutor } from "../src/execution/executors/visage-executor.js";

test("aplica Visage global no escopo resolvido", async (t) => {
  const calls = [];
  const source = { id: "source", document: { uuid: "Scene.scene.Token.source" } };
  const target = { id: "target", document: { uuid: "Scene.scene.Token.target" } };
  globalThis.game = { modules: new Map([["visage", { active: true, api: { apply: async (token, id) => calls.push([token, id]) } }]]) };
  t.after(() => { delete globalThis.game; });

  await VisageExecutor.execute({ mode: "global", scope: "targets", visageId: "fire-form" }, { source, target, targets: [target, target] });
  assert.deepEqual(calls, [[target, "fire-form"]]);
});

test("aplica Visage local somente ao token pré-configurado", async (t) => {
  const calls = [];
  const token = { id: "local", document: { uuid: "Scene.scene.Token.local" } };
  globalThis.game = { modules: new Map([["visage", { active: true, api: { apply: async (target, id) => calls.push([target, id]) } }]]) };
  globalThis.fromUuid = async (uuid) => uuid === "Scene.scene.Token.local" ? { object: token } : null;
  t.after(() => { delete globalThis.game; delete globalThis.fromUuid; });

  await VisageExecutor.execute({ mode: "local", localTokenUuid: "Scene.scene.Token.local", visageId: "local-form" }, { source: null, target: null, targets: [] });
  assert.deepEqual(calls, [[token, "local-form"]]);
});

test("explica quando Visage não está ativo ou a configuração local está incompleta", async (t) => {
  globalThis.game = { modules: new Map() };
  t.after(() => { delete globalThis.game; });
  await assert.rejects(VisageExecutor.execute({ mode: "global", visageId: "form" }, { target: {} }), /Visage ativo/);
});