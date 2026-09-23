import test from "node:test";
import assert from "node:assert/strict";
import { CompatibilityService } from "../src/services/compatibility-service.js";

test("relata a matriz declarada de Foundry e Sequencer", (t) => {
  globalThis.game = {
    version: "13.350",
    modules: new Map([["sequencer", { version: "3.6.10" }]])
  };
  t.after(() => delete globalThis.game);
  const report = new CompatibilityService().report();
  assert.equal(report.foundry.supported, true);
  assert.equal(report.foundry.verified, true);
  assert.equal(report.sequencer.supported, true);
});
