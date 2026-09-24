import test from "node:test";
import assert from "node:assert/strict";
import { MoveTokenExecutor } from "../src/execution/executors/move-token-executor.js";

function withGM(t) {
  globalThis.game = { user: { id: "gm", isGM: true } };
  globalThis.canvas = { grid: { size: 100 } };
  t.after(() => { delete globalThis.game; delete globalThis.canvas; });
}

test("teleporta o token ao ponto escolhido e ajusta a grade", async (t) => {
  withGM(t);
  const updates = [];
  const document = {
    id: "source", width: 1, height: 2,
    update: async (data, options) => { updates.push([data, options]); return document; }
  };
  await MoveTokenExecutor.execute({ scope: "source", destination: "location", mode: "teleport", snapToGrid: true }, {
    source: { document }, target: null, targets: [], location: { x: 455, y: 390 }
  });
  assert.deepEqual(updates, [[{ x: 400, y: 300 }, { animate: false }]]);
});

test("move com animação do Foundry até o alvo", async (t) => {
  withGM(t);
  const updates = [];
  const source = {
    id: "source", width: 1, height: 1,
    update: async (data, options) => { updates.push([data, options]); return source; }
  };
  await MoveTokenExecutor.execute({ scope: "source", destination: "target", mode: "move", snapToGrid: false }, {
    source: { document: source }, target: { center: { x: 500, y: 350 } }, targets: [], location: null
  });
  assert.deepEqual(updates, [[{ x: 450, y: 300 }, { animate: true }]]);
});

test("recusa mover sem tokens ou sem destino", async (t) => {
  withGM(t);
  await assert.rejects(
    MoveTokenExecutor.execute({ scope: "target", destination: "location" }, { source: null, target: null, targets: [], location: { x: 1, y: 1 } }),
    /não encontrou tokens/
  );
  await assert.rejects(
    MoveTokenExecutor.execute({ scope: "source", destination: "location" }, { source: { document: { id: "source", update: async () => {} } }, target: null, targets: [], location: null }),
    /destino válido/
  );
});
test("jogador delega ao GM o movimento de token sem permissão", async (t) => {
  const previous = { game: globalThis.game, canvas: globalThis.canvas, CONST: globalThis.CONST, Macro: globalThis.Macro, fromUuid: globalThis.fromUuid };
  const player = { id: "player", active: true, isGM: false };
  const gm = { id: "gm", active: true, isGM: true };
  const updates = [];
  const source = {
    id: "source", width: 1, height: 1, isOwner: false, uuid: "Scene.scene.Token.source",
    actor: { testUserPermission: (user) => user.id === player.id },
    update: async (data, options) => { updates.push([data, options, game.user.id]); return source; }
  };
  const step = { id: "move-step", type: "moveToken", scope: "source", destination: "location", mode: "teleport", snapToGrid: false };
  const project = { id: "project", steps: [step], sharing: {} };
  class TestMacro {
    constructor() { this.id = "macro"; this.uuid = "Macro.move"; this.visible = true; this.isOwner = false; }
    getFlag() { return project; }
    testUserPermission(user) { return user.id === player.id; }
  }
  const macro = new TestMacro();
  const emitted = [];
  let handler;
  const socket = {
    on: (_event, callback) => { handler = callback; },
    emit: (_event, payload) => {
      emitted.push(payload);
      if (payload.action !== "moveToken") return;
      queueMicrotask(async () => {
        game.user = gm;
        await handler(payload, player.id);
        game.user = player;
        handler(emitted.find((entry) => entry.action === "moveTokenResult" && entry.requestId === payload.requestId), gm.id);
      });
    }
  };
  globalThis.Macro = TestMacro;
  globalThis.fromUuid = async (uuid) => uuid === macro.uuid ? macro : null;
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2, OWNER: 3 } };
  globalThis.canvas = { scene: { id: "scene" }, grid: { size: 100 } };
  globalThis.game = {
    user: player,
    users: { activeGM: gm, contents: [player, gm], get: (id) => id === player.id ? player : id === gm.id ? gm : null },
    socket,
    scenes: new Map([["scene", { tokens: new Map([[source.id, source]]), grid: { size: 100 } }]])
  };
  MoveTokenExecutor.registered = false;
  MoveTokenExecutor.pending.clear();
  t.after(() => {
    MoveTokenExecutor.registered = false;
    MoveTokenExecutor.pending.clear();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });

  MoveTokenExecutor.registerSocket();
  const result = await MoveTokenExecutor.execute(step, { macro, source: { document: source }, target: null, targets: [], location: { x: 500, y: 500 } });
  assert.deepEqual(result, { requested: true, movedByGM: true });
  assert.deepEqual(updates, [[{ x: 450, y: 450 }, { animate: false }, "gm"]]);
});
