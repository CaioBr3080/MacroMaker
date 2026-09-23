import test from "node:test";
import assert from "node:assert/strict";
import { TargetGeometry } from "../src/targeting/target-geometry.js";

test("detecta pontos em círculo, cone e linha", () => {
  assert.equal(TargetGeometry.pointInCircle({ x: 3, y: 4 }, {
    center: { x: 0, y: 0 }, radius: 5
  }), true);
  assert.equal(TargetGeometry.pointInCircle({ x: 6, y: 0 }, {
    center: { x: 0, y: 0 }, radius: 5
  }), false);

  assert.equal(TargetGeometry.pointInCone({ x: 8, y: 2 }, {
    origin: { x: 0, y: 0 }, radius: 10, direction: 0, angle: 60
  }), true);
  assert.equal(TargetGeometry.pointInCone({ x: 2, y: 8 }, {
    origin: { x: 0, y: 0 }, radius: 10, direction: 0, angle: 60
  }), false);

  assert.equal(TargetGeometry.pointInLine({ x: 5, y: 1 }, {
    origin: { x: 0, y: 0 }, destination: { x: 10, y: 0 }, width: 4
  }), true);
  assert.equal(TargetGeometry.pointInLine({ x: 5, y: 3 }, {
    origin: { x: 0, y: 0 }, destination: { x: 10, y: 0 }, width: 4
  }), false);
});

test("filtra aliados e inimigos e nunca inclui a origem", () => {
  const source = { id: "source", document: { disposition: 1 } };
  const ally = { id: "ally", document: { disposition: 1 } };
  const enemy = { id: "enemy", document: { disposition: -1 } };
  const neutral = { id: "neutral", document: { disposition: 0 } };
  const tokens = [source, ally, enemy, neutral];

  assert.deepEqual(TargetGeometry.filterTokens(tokens, { source, filter: "ally" }), [ally]);
  assert.deepEqual(TargetGeometry.filterTokens(tokens, { source, filter: "enemy" }), [enemy]);
  assert.deepEqual(TargetGeometry.filterTokens(tokens, { source, filter: "all" }), [ally, enemy, neutral]);
});
