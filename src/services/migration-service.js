import { MODULE_ID, PROJECT_FLAG, SCHEMA_VERSION } from "../constants.js";
import { migrateProject } from "../migrations/core-migrations.js";
import { ProjectValidator } from "../validation/project-validator.js";
import { seedProjectIds } from "../utils/project-ids.js";

export class MigrationService {
  constructor(stepRegistry) {
    this.stepRegistry = stepRegistry;
  }

  createBackup(macros = this.#projectMacros()) {
    return JSON.stringify({
      format: "macro-maker-backup",
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      projects: macros.map((macro) => ({
        uuid: macro.uuid,
        name: macro.name,
        command: macro.command,
        project: foundry.utils.deepClone(macro.getFlag(MODULE_ID, PROJECT_FLAG))
      }))
    }, null, 2);
  }

  async migrateAll({ macros = this.#projectMacros() } = {}) {
    if (!game.user.isGM) throw new Error("Somente o GM pode executar migrações em lote.");
    const backup = this.createBackup(macros);
    const results = [];
    for (const macro of macros) {
      try {
        const seed = macro.id ?? String(macro.uuid).replace(/[^A-Za-z0-9_-]/g, "_");
        const source = macro.getFlag(MODULE_ID, PROJECT_FLAG);
        const seeded = seedProjectIds(source, seed);
        const identityChanged = JSON.stringify(seeded) !== JSON.stringify(source);
        const migration = migrateProject(seeded);
        migration.changed ||= identityChanged;
        if (migration.changed) {
          const project = ProjectValidator.normalize(migration.project, { stepRegistry: this.stepRegistry });
          await macro.update({
            command: `await game.macroMaker.executeMacro(${JSON.stringify(macro.uuid)});`,
            [`flags.${MODULE_ID}.${PROJECT_FLAG}`]: project
          });
        }
        results.push({ uuid: macro.uuid, name: macro.name, success: true, changed: migration.changed, applied: migration.applied });
      } catch (error) {
        results.push({ uuid: macro.uuid, name: macro.name, success: false, changed: false, error: error.message });
      }
    }
    return { backup, results, success: results.filter((item) => item.success).length, failed: results.filter((item) => !item.success).length };
  }

  #projectMacros() {
    return game.macros.contents.filter((macro) => Boolean(macro.getFlag(MODULE_ID, PROJECT_FLAG)));
  }
}
