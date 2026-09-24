import test from "node:test";
import assert from "node:assert/strict";
import { TokenUpdateExecutor } from "../src/execution/executors/token-update-executor.js";

test("modifica somente TokenDocuments do escopo escolhido", async () => {
  const updates = [];
  const first = { id: "first", update: async (data) => { updates.push(["first", data]); return first; } };
  const second = { id: "second", update: async (data) => { updates.push(["second", data]); return second; } };
  const context = {
    source: { document: first },
    target: { document: second },
    targets: [{ document: second }, { document: second }]
  };

  await TokenUpdateExecutor.execute({
    scope: "targets",
    changes: { name: "Iluminado", alpha: 0.5, sight: { enabled: true, range: 18 }, light: { bright: 6 } }
  }, context);

  assert.deepEqual(updates, [["second", {
    name: "Iluminado",
    alpha: 0.5,
    sight: { enabled: true, range: 18 },
    light: { bright: 6 }
  }]]);
  assert.equal(first.update, first.update);
});

test("recusa executar modificação sem token ou sem campos", async () => {
  await assert.rejects(
    TokenUpdateExecutor.execute({ scope: "target", changes: { name: "X" } }, { target: null, targets: [], source: null }),
    /não encontrou tokens/
  );
  await assert.rejects(
    TokenUpdateExecutor.execute({ scope: "source", changes: {} }, { source: { document: { update: async () => {} } }, targets: [], target: null }),
    /ao menos uma alteração/
  );
});