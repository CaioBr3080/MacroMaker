import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("textareas visuais usam marcador invisível para preservar parágrafos nas bordas", async () => {
  const template = await readFile(new URL("../templates/macro-maker.hbs", import.meta.url), "utf8");
  const occurrences = template.match(/data-preserve-leading-newline>&#xfeff;/g) ?? [];
  assert.ok(occurrences.length >= 8);
});