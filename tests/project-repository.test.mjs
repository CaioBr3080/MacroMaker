import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../src/services/project-repository.js";

function installFoundryMock() {
  const creates = [];
  globalThis.CONST = {
    DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OBSERVER: 2, OWNER: 3 }
  };
  globalThis.game = {
    user: { id: "player-id", name: "Player", isGM: false, can: (permission) => permission === "MACRO_SCRIPT" }
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
    isOwner: true,
    folder: { id: "folder-id" },
    getFlag: () => ({ name: "Antigo", steps: [{ type: "wait", ms: 1 }] })
  };

  await ProjectRepository.duplicate(source);

  const copy = creates[0].flags["macro-maker"].project;
  assert.equal(copy.name, "Antigo (cópia)");
  assert.equal(copy.metadata.createdBy, "player-id");
  assert.equal(creates[0].folder, "folder-id");
});

test("OBSERVER executa conforme política, mas bloqueios do GM impedem salvar campos protegidos", async (t) => {
  t.after(clearFoundryMock);
  installFoundryMock();
  const observerMacro = {
    isOwner: false,
    testUserPermission: (_user, level) => level === 2
  };
  assert.equal(ProjectRepository.canExecute(observerMacro, { sharing: { observerCanExecute: true } }), true);
  assert.equal(ProjectRepository.canExecute(observerMacro, { sharing: { observerCanExecute: false } }), false);

  const original = {
    schemaVersion: 2,
    id: "project-test",
    name: "Protegido",
    targeting: { source: "none", mode: "none", range: 5 },
    variables: {},
    steps: [],
    sharing: { observerCanExecute: true, lockedFields: ["targeting.range"] },
    metadata: {}
  };
  const ownerMacro = {
    isOwner: true,
    uuid: "Macro.locked",
    img: "icon.svg",
    getFlag: () => original,
    async update() { throw new Error("não deveria atualizar"); }
  };
  const changed = structuredClone(original);
  changed.targeting.range = 10;
  await assert.rejects(ProjectRepository.update(ownerMacro, changed), /bloqueado pelo GM/);
});

test("atribuição preserva ownership de outros usuários, inclusive se o destinatário está offline", async (t) => {
  t.after(() => {
    clearFoundryMock();
    delete globalThis.fromUuid;
  });
  installFoundryMock();
  game.user.isGM = true;
  game.users = new Map([["offline", { id: "offline", active: false }]]);
  const macro = new Macro();
  macro.uuid = "Macro.shared";
  macro.ownership = { default: 0, existing: 2 };
  macro.getFlag = () => ({ schemaVersion: 2, id: "project-shared", name: "Compartilhado", steps: [] });
  macro.update = async (data) => { macro.lastUpdate = data; };
  globalThis.fromUuid = async () => macro;

  await ProjectRepository.assign(macro.uuid, "offline", 3);

  assert.equal(macro.lastUpdate.ownership.existing, 2);
  assert.equal(macro.lastUpdate.ownership.offline, 3);
});

test("exclusão exige ownership", async () => {
  await assert.rejects(ProjectRepository.delete({ isOwner: false }), /não pode excluir/);
});

test("Todos atribui acesso a usuários atuais e futuros sem alterar o objeto recebido", async (t) => {
  t.after(clearFoundryMock);
  const creates = installFoundryMock();
  game.user.isGM = true;
  game.users = new Map([["one", { id: "one" }], ["offline", { id: "offline", active: false }]]);
  const ownership = { default: 0, one: 0, previous: 3 };
  await ProjectRepository.create({ name: "Grupo", steps: [], sharing: { userId: "*", level: 2 } }, { ownership });
  assert.deepEqual(creates[0].ownership, { default: 2, one: 2, previous: 2, offline: 2 });
  assert.deepEqual(ownership, { default: 0, one: 0, previous: 3 });
  assert.equal(Object.hasOwn(creates[0].ownership, "*"), false);
});

test("Todos funciona ao atualizar, inclusive NONE, e raiz remove a pasta", async (t) => {
  t.after(clearFoundryMock);
  installFoundryMock();
  game.user.isGM = true;
  game.users = new Map([["player", { id: "player" }]]);
  const macro = {
    isOwner: true, uuid: "Macro.test", img: "icon.svg",
    ownership: { default: 3, player: 3, old: 2 },
    getFlag: () => ({ name: "Antes", steps: [] }),
    update: async (data) => data
  };
  const updated = await ProjectRepository.update(macro, { name: "Agora", steps: [], sharing: { userId: "*", level: 0, folderId: "" } });
  assert.deepEqual(updated.ownership, { default: 0, player: 0, old: 0 });
  assert.equal(updated.folder, null);
});

test("criação por jogador não aplica atribuição Todos herdada do projeto", async (t) => {
  t.after(clearFoundryMock);
  const creates = installFoundryMock();
  await ProjectRepository.create({ name: "Cópia", steps: [], sharing: { userId: "*", level: 3 } });
  assert.deepEqual(creates[0].ownership, { default: 0, "player-id": 3 });
});
