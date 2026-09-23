import test from "node:test";
import assert from "node:assert/strict";
import { regenerateProjectIds } from "../src/utils/project-ids.js";

test("duplicação regenera IDs internos e reescreve referências entre etapas", () => {
  const source = {
    id: "project-original",
    steps: [
      { id: "step-target", type: "wait", ms: 1 },
      { id: "step-mutation", type: "mutateSteps", action: "remove", targetId: "step-target" },
      { id: "step-remove", type: "removePersistent", scope: "step", stepId: "step-target" }
    ]
  };
  const copy = regenerateProjectIds(source);

  assert.notEqual(copy.id, source.id);
  assert.notEqual(copy.steps[0].id, source.steps[0].id);
  assert.equal(copy.steps[1].targetId, copy.steps[0].id);
  assert.equal(copy.steps[2].stepId, copy.steps[0].id);
  assert.equal(source.steps[1].targetId, "step-target");
});
