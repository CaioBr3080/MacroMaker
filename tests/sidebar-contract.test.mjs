import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Only expose the bases needed to import the module. These tests verify its
// configuration contract, not a simulated Foundry renderer.
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: (Base) => Base },
    sidebar: { AbstractSidebarTab: class {} }
  }
};
const { MacroMakerSidebar } = await import("../src/apps/macro-maker-sidebar.js");
delete globalThis.foundry;

test("o ID da aba coincide com o placeholder usado pelo Foundry", () => {
  // ApplicationV2 replaces {id} with AbstractSidebarTab's uniqueId (tabName).
  // A mismatch causes insertion in document.body instead of #sidebar-content.
  const id = MacroMakerSidebar.DEFAULT_OPTIONS.id.replace("{id}", MacroMakerSidebar.tabName);
  assert.equal(id, MacroMakerSidebar.tabName);
  assert.equal(id, "macro-maker");
});

test("o editor não estiliza a classe de sidebar gerada pelo Foundry", async () => {
  const [css, template] = await Promise.all([
    readFile(new URL("../styles/macro-maker.css", import.meta.url), "utf8"),
    readFile(new URL("../templates/macro-maker.hbs", import.meta.url), "utf8")
  ]);
  const nativeClass = `${MacroMakerSidebar.tabName}-sidebar`;
  const selectors = css.split("{").slice(0, -1).map((part) => part.slice(part.lastIndexOf("}") + 1));
  const nativeSelector = new RegExp(`\\.${nativeClass}(?![\\w-])`);
  assert.ok(selectors.every((selector) => !nativeSelector.test(selector)),
    "A classe nativa não deve receber o display flex, padding e overflow do editor");
  assert.match(template, /<aside class="macro-maker-editor-sidebar">/);
  assert.match(css, /\.macro-maker-editor-sidebar\s*\{/);
});
