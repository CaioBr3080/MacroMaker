import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../src/services/project-repository.js";

function installFoundryMock() {
  const creates = [];
  globalThis.CONST = {
    DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OWNER: 3 }
  };
  globalThis.game = {
    user: { id: "player-id", can: (permission) => permission === "MACRO_SCRIPT" }
  };
  globalThis.foundry = {
    utils: { deepClone: (value) => structuredClone(value) }
  };
  globalThis.Macro = class {
    static async create(data) {
      creates.push(structuredClone(data));
      return {
        id: "macro-id",
        uuid: "Macro.macro-id",
        async update(update) {
          this.lastUpdate = update;
          return this;
        }
      };
    }
  };
  return creates;
}

function clearFoundryMock() {
  delete globalThis.CONST;
  delete globalThis.game;
  delete globalThis.foundry;
  delete globalThis.Macro;
}

test("cria um único Macro pertencente ao usuário e compila seu UUID", async (t) => {
  t.after(clearFoundryMock);
  const creates = installFoundryMock();
  const input = { name: "Teste", icon: "icon.svg", metadata: {}, steps: [] };

  const macro = await ProjectRepository.create(input);

  assert.equal(creates.length, 1);
  assert.deepEqual(creates[0].ownership, { default: 0, "player-id": 3 });
  assert.equal(creates[0].flags["macro-maker"].project.metadata.createdBy, "player-id");
  assert.equal(input.metadata.createdBy, undefined);
  assert.equal(macro.lastUpdate.command, 'await game.macroMaker.executeMacro("Macro.macro-id");');
});

test("preserva ownership fornecido explicitamente", async (t) => {
  t.after(clearFoundryMock);
  const creates = installFoundryMock();
  const ownership = { default: 2, "other-user": 3 };

  await ProjectRepository.create({ name: "Compartilhado", steps: [] }, { ownership });

  assert.deepEqual(creates[0].ownership, ownership);
});

test("duplica projeto antigo sem metadata e sem compartilhar referências", async (t) => {
  t.after(clearFoundryMock);
  const creates = installFoundryMock();
  const source = {
    folder: { id: "folder-id" },
    getFlag: () => ({ name: "Antigo", steps: [{ type: "wait", ms: 1 }] })
  };

  await ProjectRepository.duplicate(source);

  const copy = creates[0].flags["macro-maker"].project;
  assert.equal(copy.name, "Antigo (cópia)");
  assert.equal(copy.metadata.createdBy, "player-id");
  assert.equal(creates[0].folder, "folder-id");
});
