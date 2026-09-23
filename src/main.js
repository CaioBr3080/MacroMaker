import { MODULE_ID } from "./constants.js";
import { MacroMakerAPI } from "./api.js";
import { MacroMakerApp } from "./apps/macro-maker-app.js";
import { MacroMakerSidebar } from "./apps/macro-maker-sidebar.js";

Hooks.once("init", () => {
  console.info("Macro Maker | inicializando");
  CONFIG.ui[MODULE_ID] = MacroMakerSidebar;
  CONFIG.ui.sidebar.TABS[MODULE_ID] = {
    icon: "fas fa-wand-magic-sparkles",
    tooltip: "Macro Maker"
  };
  game.settings.register(MODULE_ID, "debug", {
    name: "Modo de depuração",
    hint: "Exibe informações extras no console.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "customTemplates", {
    name: "Templates personalizados do Macro Maker",
    scope: "world",
    config: false,
    type: Object,
    default: []
  });
});

Hooks.once("ready", () => {
  const api = new MacroMakerAPI(MacroMakerApp);
  game.macroMaker = api;
  game.modules.get(MODULE_ID).api = api;
  const compatibility = api.compatibility.report();
  if (!compatibility.foundry.supported || !compatibility.sequencer.supported) {
    console.warn("Macro Maker | ambiente fora da matriz declarada", compatibility);
  }
  Hooks.callAll("macroMaker.ready", api);
});

Hooks.on("renderMacroDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector("[data-macro-maker-launcher]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.macroMakerLauncher = "true";
  button.className = "macro-maker-launcher";
  button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Macro Maker';
  button.addEventListener("click", () => game.macroMaker.open());

  const target = root.querySelector(".directory-header .header-actions")
    ?? root.querySelector(".directory-header")
    ?? root;
  target.append(button);
});

Hooks.on("renderMacroConfig", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const project = app.object?.getFlag?.(MODULE_ID, "project");
  if (!root || !project || root.querySelector("[data-open-macro-maker]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.openMacroMaker = "true";
  button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Editar no Macro Maker';
  button.addEventListener("click", () => game.macroMaker.open(app.object.uuid));
  root.querySelector("footer")?.prepend(button);
});

Hooks.on("preDeleteToken", (document) => game.macroMaker?.persistents?.cleanupDocument(document));
Hooks.on("preDeleteScene", (document) => game.macroMaker?.persistents?.cleanupDocument(document));
Hooks.on("sequencerEffectManagerReady", () => ui[MODULE_ID]?.render?.());
Hooks.on("endedSequencerEffect", () => ui[MODULE_ID]?.render?.());
