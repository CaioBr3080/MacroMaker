import test from "node:test";
import assert from "node:assert/strict";
import { ProjectHistory } from "../src/apps/project-history.js";

test("mantém undo e redo sem compartilhar referências mutáveis", () => {
  const history = new ProjectHistory({ steps: [] });
  const second = { steps: [{ type: "wait", ms: 100 }] };
  history.commit(second);
  second.steps[0].ms = 999;
  history.commit({ steps: [{ type: "wait", ms: 200 }] });

  assert.equal(history.canUndo, true);
  const undo = history.undo();
  assert.equal(undo.steps[0].ms, 100);
  undo.steps[0].ms = 500;
  assert.equal(history.redo().steps[0].ms, 200);
  assert.equal(history.undo().steps[0].ms, 100);
});

test("descarta o ramo de redo após uma nova alteração", () => {
  const history = new ProjectHistory({ value: 1 });
  history.commit({ value: 2 });
  history.commit({ value: 3 });
  assert.equal(history.undo().value, 2);
  history.commit({ value: 4 });
  assert.equal(history.canRedo, false);
  assert.equal(history.undo().value, 2);
});

test("ignora snapshots idênticos", () => {
  const history = new ProjectHistory({ value: 1 });
  assert.equal(history.commit({ value: 1 }), false);
  assert.equal(history.canUndo, false);
});
