import { SCHEMA_VERSION } from "../constants.js";
import { migrateProject } from "../migrations/core-migrations.js";
import { ProjectValidator } from "../validation/project-validator.js";
import { regenerateProjectIds } from "../utils/project-ids.js";
import { clone, escapeHtml } from "../utils/safe-values.js";

function project(name, targeting, steps) {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    description: "",
    icon: "icons/svg/dice-target.svg",
    targeting: {
      source: "controlled",
      mode: "currentTargets",
      filter: "enemy",
      minTargets: 1,
      maxTargets: 1,
      range: null,
      blockOutOfRange: false,
      radius: 3,
      angle: 90,
      width: 1,
      ...targeting
    },
    variables: {},
    sharing: { folderId: "", userId: "", level: 3, observerCanExecute: true, hotbarSlot: null, lockedFields: [] },
    steps,
    metadata: {}
  };
}

const BUILT_INS = Object.freeze([
  { id: "melee", name: "Ataque corpo a corpo", category: "Combate", project: project("Ataque corpo a corpo", { range: 2, blockOutOfRange: true }, [{ type: "attack", label: "Ataque", formula: "1d20", criticalThreshold: 20, hitMode: "auto" }, { type: "damage", label: "Dano", formula: "1d8" }]) },
  { id: "ranged", name: "Ataque à distância", category: "Combate", project: project("Ataque à distância", { range: 18, blockOutOfRange: true }, [{ type: "attack", label: "Disparo", formula: "1d20", criticalThreshold: 20, hitMode: "auto" }, { type: "animation", label: "Projétil", file: "jb2a.", source: "source", target: "target", stretchTo: true }, { type: "damage", label: "Dano", formula: "1d6" }]) },
  { id: "area", name: "Ataque em área", category: "Combate", project: project("Ataque em área", { mode: "circle", maxTargets: 20, radius: 3 }, [{ type: "test", label: "Teste da área", formula: "1d20" }, { type: "damage", label: "Dano em área", formula: "2d6" }]) },
  { id: "ritual", name: "Ritual", category: "Utilidade", project: project("Ritual", { mode: "none", minTargets: 0, maxTargets: 0, filter: "all" }, [{ type: "menu", label: "Escolher ritual", variable: "ritual", selection: "single", cancelBehavior: "abort", columns: 1, options: [{ label: "Versão padrão", value: "standard" }] }, { type: "test", label: "Teste do ritual", formula: "1d20" }]) },
  { id: "buff", name: "Buff", category: "Efeitos", project: project("Buff", { filter: "ally" }, [{ type: "animation", label: "Buff persistente", file: "jb2a.", source: "target", persist: true, name: "buff", tags: ["buff"], duplicatePolicy: "replace" }]) },
  { id: "debuff", name: "Debuff", category: "Efeitos", project: project("Debuff", {}, [{ type: "animation", label: "Debuff persistente", file: "jb2a.", source: "target", persist: true, name: "debuff", tags: ["debuff"], duplicatePolicy: "replace" }]) },
  { id: "healing", name: "Cura", category: "Suporte", project: project("Cura", { filter: "ally" }, [{ type: "healing", label: "Cura", formula: "1d8" }, { type: "animation", label: "Efeito de cura", file: "jb2a.", source: "target" }]) },
  { id: "teleport", name: "Teleporte", category: "Movimento", project: project("Teleporte", { mode: "point", filter: "all", minTargets: 1 }, [{ type: "animation", label: "Saída", file: "jb2a.", source: "source" }, { type: "animation", label: "Chegada", file: "jb2a.", source: "location" }]) },
  { id: "aura", name: "Aura persistente", category: "Efeitos", project: project("Aura persistente", { filter: "ally", minTargets: 0 }, [{ type: "animation", label: "Aura", file: "jb2a.", source: "source", attachTo: true, persist: true, name: "aura", tags: ["aura"], duplicatePolicy: "replace" }]) }
]);

function customTemplates() {
  const stored = globalThis.game?.settings?.get?.("macro-maker", "customTemplates") ?? [];
  return clone(Array.isArray(stored) ? stored : stored.templates ?? []);
}

export class ProjectTemplateService {
  constructor(stepRegistry) {
    this.stepRegistry = stepRegistry;
  }

  list({ query = "", category = "" } = {}) {
    const custom = customTemplates();
    const normalizedQuery = String(query).trim().toLocaleLowerCase();
    return [...BUILT_INS.map((template) => ({ ...template, builtIn: true })), ...custom]
      .filter((template) => !category || template.category === category)
      .filter((template) => !normalizedQuery || `${template.name} ${template.category}`.toLocaleLowerCase().includes(normalizedQuery))
      .map(({ project: source, ...metadata }) => ({ ...metadata, description: source.description ?? "" }));
  }

  instantiate(id) {
    const custom = customTemplates();
    const template = BUILT_INS.find((item) => item.id === id) ?? custom.find((item) => item.id === id);
    if (!template) throw new Error(`Template não encontrado: ${id}.`);
    return ProjectValidator.normalize(regenerateProjectIds(template.project), { stepRegistry: this.stepRegistry });
  }

  async save(projectSource, { name = projectSource.name, category = "Personalizados" } = {}) {
    if (!game.user.isGM) throw new Error("Somente o GM pode salvar templates do mundo.");
    const normalized = ProjectValidator.normalize(projectSource, { stepRegistry: this.stepRegistry });
    const templates = customTemplates();
    const template = {
      id: `custom-${foundry.utils.randomID()}`,
      name: String(name).trim() || normalized.name,
      category: String(category).trim() || "Personalizados",
      builtIn: false,
      project: regenerateProjectIds(normalized)
    };
    templates.push(template);
    await game.settings.set("macro-maker", "customTemplates", templates);
    return { ...template, project: undefined };
  }

  export(projectSource) {
    const normalized = ProjectValidator.normalize(projectSource, { stepRegistry: this.stepRegistry });
    return JSON.stringify({
      format: "macro-maker-project",
      exportVersion: 1,
      schemaVersion: normalized.schemaVersion,
      exportedAt: new Date().toISOString(),
      project: normalized
    }, null, 2);
  }

  async previewImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON de importação inválido: ${error.message}`);
    }
    const source = data?.format === "macro-maker-project" ? data.project : data;
    const migration = migrateProject(source);
    const projectSource = ProjectValidator.normalize(migration.project, { stepRegistry: this.stepRegistry });
    const missingAssets = await this.findMissingAssets(projectSource);
    return { project: projectSource, migration, missingAssets };
  }

  instantiateImport(preview) {
    return ProjectValidator.normalize(regenerateProjectIds(preview.project), { stepRegistry: this.stepRegistry });
  }

  resolveAssets(preview, replacements = {}) {
    const projectSource = clone(preview.project);
    const visit = (steps) => {
      for (const step of steps ?? []) {
        if (Object.prototype.hasOwnProperty.call(replacements, step.id) && replacements[step.id]) {
          step.file = String(replacements[step.id]);
        }
        visit(step.then);
        visit(step.else);
        if (step.step) visit([step.step]);
      }
    };
    visit(projectSource.steps);
    return { ...preview, project: projectSource };
  }

  async findMissingAssets(projectSource) {
    const entries = [];
    const visit = (steps) => {
      for (const step of steps ?? []) {
        if (["animation", "sound"].includes(step.type) && step.file) entries.push({ stepId: step.id, label: step.label, file: step.file });
        visit(step.then);
        visit(step.else);
        if (step.step) visit([step.step]);
      }
    };
    visit(projectSource.steps);
    const missing = [];
    for (const entry of entries) {
      try {
        let exists = true;
        if (!entry.file.includes("/")) {
          exists = Boolean(await globalThis.Sequencer?.Database?.getEntry?.(entry.file, { softFail: true }));
        } else {
          const separator = entry.file.lastIndexOf("/");
          const directory = entry.file.slice(0, separator);
          const picker = globalThis.FilePicker ?? globalThis.foundry?.applications?.apps?.FilePicker;
          const result = picker?.browse ? await picker.browse("data", directory) : null;
          exists = result ? (result.files ?? []).includes(entry.file) : true;
        }
        if (!exists) missing.push({ ...entry, reason: "Caminho não encontrado." });
      } catch (error) {
        missing.push({ ...entry, reason: error.message });
      }
    }
    return missing;
  }

  importSummary(preview) {
    if (!preview.missingAssets.length) return "Nenhum caminho ausente detectado.";
    return `<ul>${preview.missingAssets.map((item) => `<li><strong>${escapeHtml(item.label ?? item.stepId)}</strong>: ${escapeHtml(item.file)}</li>`).join("")}</ul>`;
  }
}
