import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("etapa desabilitada usa classe exclusiva e mantém os controles clicáveis", async () => {
  const [template, css, app] = await Promise.all([
    readFile(new URL("../templates/macro-maker.hbs", import.meta.url), "utf8"),
    readFile(new URL("../styles/macro-maker.css", import.meta.url), "utf8"),
    readFile(new URL("../src/apps/macro-maker-app.js", import.meta.url), "utf8")
  ]);

  assert.match(template, /macro-maker-step-disabled/);
  assert.doesNotMatch(template, /macro-maker-step \{\{#unless isEnabled\}\}disabled/);
  assert.match(css, /\.macro-maker-step\.macro-maker-step-disabled/);
  assert.match(app, /classList\.toggle\("macro-maker-step-disabled", !element\.checked\)/);
});