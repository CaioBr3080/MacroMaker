import { clone } from "../utils/safe-values.js";

export class MigrationRegistry {
  #migrations = new Map();

  register(from, to, migrate) {
    if (!Number.isInteger(from) || to !== from + 1) {
      throw new Error("Cada migração precisa avançar exatamente uma versão.");
    }
    if (typeof migrate !== "function") throw new Error("A migração precisa ser uma função.");
    if (this.#migrations.has(from)) throw new Error(`Já existe uma migração partindo da versão ${from}.`);
    this.#migrations.set(from, { from, to, migrate });
    return this;
  }

  migrate(input, targetVersion) {
    let project = clone(input);
    let version = Number(project?.schemaVersion ?? 1);
    const applied = [];
    if (!Number.isInteger(version) || version < 1) throw new Error(`Versão de schema inválida: ${project?.schemaVersion}.`);
    if (version > targetVersion) throw new Error(`O projeto usa schema ${version}, mais novo que o schema suportado ${targetVersion}.`);

    while (version < targetVersion) {
      const migration = this.#migrations.get(version);
      if (!migration) throw new Error(`Não existe migração registrada de ${version} para ${version + 1}.`);
      const migrated = migration.migrate(clone(project));
      if (!migrated || typeof migrated !== "object" || Array.isArray(migrated)) {
        throw new Error(`A migração ${version}→${migration.to} retornou um projeto inválido.`);
      }
      migrated.schemaVersion = migration.to;
      project = migrated;
      applied.push({ from: version, to: migration.to });
      version = migration.to;
    }
    return { project, fromVersion: Number(input?.schemaVersion ?? 1), toVersion: version, applied, changed: applied.length > 0 };
  }
}
