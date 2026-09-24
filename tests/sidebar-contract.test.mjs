import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class ApplicationV2 {
  async _prepareContext() { return {}; }
  async _onRender() {}
  async _onClose() {}
}

globalThis.foundry = {
  applications: {
    api: { ApplicationV2, HandlebarsApplicationMixin: (Base) => Base }
  }
};
const { MacroMakerManager } = await import("../src/apps/macro-maker-manager.js");
delete globalThis.foundry;

test("o gerenciador de macros é uma janela própria e redimensionável", () => {
  assert.equal(MacroMakerManager.DEFAULT_OPTIONS.id, "macro-maker-manager");
  assert.equal(MacroMakerManager.DEFAULT_OPTIONS.window.resizable, true);
  assert.equal(MacroMakerManager.DEFAULT_OPTIONS.window.minimizable, true);
  assert.equal(MacroMakerManager.DEFAULT_OPTIONS.position.width, 860);
});

test("a sidebar não recebe mais a aba do Macro Maker e o gerenciador possui layout próprio", async () => {
  const [main, css, template, editorTemplate] = await Promise.all([
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../styles/macro-maker.css", import.meta.url), "utf8"),
    readFile(new URL("../templates/macro-maker-manager.hbs", import.meta.url), "utf8"),
    readFile(new URL("../templates/macro-maker.hbs", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(main, /CONFIG\.ui\.sidebar\.TABS/);
  assert.match(main, /getSceneControlButtons/);
  assert.match(main, /openManager/);
  assert.match(css, /\.macro-maker-manager-layout\s*\{/);
  assert.match(template, /macro-maker-manager-tree/);
  assert.match(template, /macro-maker-manager-inspector/);
  assert.ok(template.indexOf("macro-maker-manager-favorites") < template.indexOf("macro-maker-manager-entries"));
  assert.match(editorTemplate, /<aside class="macro-maker-editor-sidebar">/);
});