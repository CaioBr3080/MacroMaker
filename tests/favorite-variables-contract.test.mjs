import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("gerenciador oferece busca e edição para variáveis frequentes", async () => {
  const [main, manager, template] = await Promise.all([
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../src/apps/macro-maker-manager.js", import.meta.url), "utf8"),
    readFile(new URL("../templates/macro-maker-manager.hbs", import.meta.url), "utf8")
  ]);
  assert.match(main, /"favoriteVariables"/);
  assert.match(manager, /collectFavoriteVariableCandidates/);
  assert.match(manager, /macro\.isOwner/);
  assert.match(manager, /save-favorite-variable/);
  assert.match(template, /data-favorite-variable-search/);
  assert.match(template, /data-favorite-variable-value/);
  assert.match(template, /\(\{\{macroName\}\}\)/);
});