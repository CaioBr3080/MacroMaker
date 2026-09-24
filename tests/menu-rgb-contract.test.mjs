import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("os campos de cor do menu recebem seletor RGB", async () => {
  const [app, template] = await Promise.all([
    readFile(new URL("../src/apps/macro-maker-app.js", import.meta.url), "utf8"),
    readFile(new URL("../templates/macro-maker.hbs", import.meta.url), "utf8")
  ]);
  assert.match(app, /titleStyle\.color/);
  assert.match(app, /descriptionStyle\.color/);
  assert.match(app, /columnSettings\\\.\\d\+\\\.titleStyle\\\.color/);
  assert.match(template, /data-step-path="titleStyle\.color"/);
  assert.match(template, /data-step-path="descriptionStyle\.color"/);
  assert.match(template, /titleStyle\.color/);
});