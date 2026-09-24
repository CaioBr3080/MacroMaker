import test from "node:test";
import assert from "node:assert/strict";
import { VisageExecutor } from "../src/execution/executors/visage-executor.js";

test("aplica Visage global no escopo resolvido", async (t) => {
  const calls = [];
  const source = { id: "source", document: { uuid: "Scene.scene.Token.source" } };
  const target = { id: "target", document: { uuid: "Scene.scene.Token.target" } };
  globalThis.game = { user: { id: "gm", isGM: true }, modules: new Map([["visage", { active: true, api: { apply: async (token, id) => calls.push([token, id]) } }]]) };
  t.after(() => { delete globalThis.game; });

  await VisageExecutor.execute({ mode: "global", scope: "targets", visageId: "fire-form" }, { source, target, targets: [target, target] });
  assert.deepEqual(calls, [[target, "fire-form"]]);
});

test("aplica Visage local somente ao token pré-configurado", async (t) => {
  const calls = [];
  const token = { id: "local", document: { uuid: "Scene.scene.Token.local" } };
  globalThis.game = { user: { id: "gm", isGM: true }, modules: new Map([["visage", { active: true, api: { apply: async (target, id) => calls.push([target, id]) } }]]) };
  globalThis.fromUuid = async (uuid) => uuid === "Scene.scene.Token.local" ? { object: token } : null;
  t.after(() => { delete globalThis.game; delete globalThis.fromUuid; });

  await VisageExecutor.execute({ mode: "local", localTokenUuid: "Scene.scene.Token.local", visageId: "local-form" }, { source: null, target: null, targets: [] });
  assert.deepEqual(calls, [[token, "local-form"]]);
});

test("explica quando Visage não está ativo ou a configuração local está incompleta", async (t) => {
  globalThis.game = { user: { id: "gm", isGM: true }, modules: new Map() };
  t.after(() => { delete globalThis.game; });
  await assert.rejects(VisageExecutor.execute({ mode: "global", visageId: "form" }, { target: {} }), /Visage ativo/);
});
test("jogador delega ao GM o Visage de token sem permissão de edição", async (t) => {
  const previous = {
    game: globalThis.game,
    canvas: globalThis.canvas,
    CONST: globalThis.CONST,
    Macro: globalThis.Macro,
    fromUuid: globalThis.fromUuid
  };
  const calls = [];
  const emitted = [];
  const player = { id: "player", active: true, isGM: false };
  const gm = { id: "gm", active: true, isGM: true };
  const target = { id: "target", document: { id: "target", uuid: "Scene.scene.Token.target", isOwner: false } };
  target.document.object = target;
  const source = { id: "source", document: { id: "source", uuid: "Scene.scene.Token.source" } };
  source.document.object = source;
  source.document.actor = { testUserPermission: (user) => user.id === player.id };
  const scene = { tokens: new Map([[source.id, source.document], [target.id, target.document]]) };
  const step = { id: "visage-step", type: "applyVisage", mode: "global", scope: "target", visageId: "enemy-form" };
  const project = { id: "project", steps: [step], sharing: {} };

  class TestMacro {
    constructor() {
      this.id = "macro";
      this.uuid = "Macro.test";
      this.visible = true;
      this.isOwner = false;
    }

    getFlag() {
      return project;
    }

    testUserPermission(user) {
      return user.id === player.id;
    }
  }
  const macro = new TestMacro();
  let socketHandler;
  const socket = {
    on: (_event, callback) => { socketHandler = callback; },
    emit: (_event, payload) => {
      emitted.push(payload);
      if (payload.action !== "applyVisage") return;
      queueMicrotask(async () => {
        game.user = gm;
        await socketHandler(payload, player.id);
        game.user = player;
        const response = emitted.find((entry) => entry.action === "applyVisageResult" && entry.requestId === payload.requestId);
        socketHandler(response, gm.id);
      });
    }
  };

  globalThis.Macro = TestMacro;
  globalThis.fromUuid = async (uuid) => uuid === macro.uuid ? macro : null;
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2, OWNER: 3 } };
  globalThis.canvas = { scene: { id: "scene" } };
  globalThis.game = {
    user: player,
    users: { activeGM: gm, contents: [player, gm], get: (id) => id === player.id ? player : id === gm.id ? gm : null },
    socket,
    scenes: new Map([["scene", scene]]),
    modules: new Map([["visage", { active: true, api: { apply: async (token, id) => calls.push([token, id, game.user.id]) } }]])
  };
  VisageExecutor.registered = false;
  VisageExecutor.pending.clear();
  t.after(() => {
    VisageExecutor.registered = false;
    VisageExecutor.pending.clear();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });

  VisageExecutor.registerSocket();
  const result = await VisageExecutor.execute(step, { macro, source, target, targets: [target] });
  assert.deepEqual(result, { requested: true, appliedByGM: true });
  assert.deepEqual(calls, [[target, "enemy-form", "gm"]]);
  assert.equal(emitted.filter((entry) => entry.action === "applyVisage").length, 1);
});
