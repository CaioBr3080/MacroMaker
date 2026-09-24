import test from "node:test";
import assert from "node:assert/strict";
import { canvasEventTarget, lockTokenInteraction } from "../src/targeting/canvas-interaction-lock.js";

test("bloqueia e restaura a interação dos tokens durante a escolha no canvas", (t) => {
  const first = { eventMode: "static", interactive: true, interactiveChildren: true };
  const second = { eventMode: "passive", interactive: true, interactiveChildren: false };
  globalThis.canvas = { tokens: { placeables: [first, second] } };
  t.after(() => { delete globalThis.canvas; });

  const unlock = lockTokenInteraction();
  assert.equal(first.eventMode, "none");
  assert.equal(first.interactive, false);
  assert.equal(first.interactiveChildren, false);
  assert.equal(second.eventMode, "none");
  unlock();
  assert.deepEqual(first, { eventMode: "static", interactive: true, interactiveChildren: true });
  assert.deepEqual(second, { eventMode: "passive", interactive: true, interactiveChildren: false });
});

test("identifica eventos do canvas pelo alvo ou pelo caminho composto", () => {
  const canvasElement = {
    contains: (element) => element === "inside"
  };
  assert.equal(canvasEventTarget(canvasElement, { target: "inside" }), true);
  assert.equal(canvasEventTarget(canvasElement, { target: "other", composedPath: () => [canvasElement] }), true);
  assert.equal(canvasEventTarget(canvasElement, { target: "other", composedPath: () => [] }), false);
});