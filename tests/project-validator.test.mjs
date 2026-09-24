import test from "node:test";
import assert from "node:assert/strict";
import { ProjectValidationError, ProjectValidator } from "../src/validation/project-validator.js";
import { StepRegistry } from "../src/execution/step-registry.js";
import { createCoreStepRegistry } from "../src/execution/core-step-registry.js";

function registry() {
  return new StepRegistry().register("custom", {
    defaults: {},
    execute: async () => {}
  });
}

test("valida estilos de mensagem e mantém variáveis numéricas do projeto", () => {
  const project = { name: "Força", variables: { FOR: 4 }, steps: [{ type: "roll", formula: "1d20 + FOR", messageStyle: { font: "Arial", size: "18", color: "#aabbcc", bold: true } }] };
  const normalized = ProjectValidator.normalize(project);
  assert.equal(normalized.variables.FOR, 4);
  assert.equal(normalized.steps[0].messageStyle.size, 18);
  for (const style of [{ size: 99 }, { size: 4 }, { color: "red;display:none" }, { font: "unknown" }, { bold: "true" }, "invalid"]) {
    assert.throws(() => ProjectValidator.normalize({ ...project, steps: [{ ...project.steps[0], messageStyle: style }] }), ProjectValidationError);
  }
});

test("preserva espaços nas bordas e no meio de descrições e mensagens", () => {
  const project = ProjectValidator.normalize({
    name: "Projeto",
    description: "  descrição com espaço final  ",
    variables: {},
    steps: [{ type: "roll", formula: "1d20", flavor: "\n\n  texto com  dois espaços  \n\n" }]
  });
  assert.equal(project.description, "  descrição com espaço final  ");
  assert.equal(project.steps[0].flavor, "\n\n  texto com  dois espaços  \n\n");
});

test("valida e normaliza a coluna opcional das opções do menu", () => {
  const project = ProjectValidator.normalize({
    name: "Menu",
    variables: {},
    steps: [{
      type: "menu",
      columnSettings: { 2: { title: "  Magias  ", textTransform: "upper" } },
      options: [{ label: "A", value: "a", column: "2" }]
    }]
  });
  assert.equal(project.steps[0].options[0].column, 2);
  assert.equal(project.steps[0].columnSettings[2].title, "  Magias  ");
  assert.equal(project.steps[0].columnSettings[2].textTransform, "upper");
  assert.throws(() => ProjectValidator.normalize({
    name: "Menu",
    variables: {},
    steps: [{ type: "menu", columnSettings: { 1: { textTransform: "invert" } }, options: [{ label: "A", value: "a", column: 7 }] }]
  }), ProjectValidationError);
});
test("normaliza o projeto sem remover propriedades desconhecidas", () => {
  const project = ProjectValidator.normalize({
    name: "  Projeto de teste  ",
    targeting: {
      source: "controlled",
      mode: "currentTargets",
      minTargets: "1",
      maxTargets: "2",
      range: "9",
      blockOutOfRange: true,
      futureTargetingOption: "preservada"
    },
    variables: {},
    steps: [{ type: "custom", futureStepOption: { enabled: true } }],
    futureProjectOption: [1, 2, 3]
  }, { stepRegistry: registry() });

  assert.equal(project.schemaVersion, 2);
  assert.equal(project.name, "Projeto de teste");
  assert.equal(project.targeting.minTargets, 1);
  assert.equal(project.targeting.maxTargets, 2);
  assert.equal(project.targeting.range, 9);
  assert.equal(project.targeting.futureTargetingOption, "preservada");
  assert.deepEqual(project.steps[0].futureStepOption, { enabled: true });
  assert.deepEqual(project.futureProjectOption, [1, 2, 3]);
});

test("retorna todos os caminhos inválidos em um único erro", () => {
  assert.throws(
    () => ProjectValidator.normalize({
      schemaVersion: 2,
      name: "",
      targeting: {
        source: "controlled",
        mode: "currentTargets",
        minTargets: 3,
        maxTargets: 1,
        range: -1,
        blockOutOfRange: "sim"
      },
      variables: [],
      steps: [{ type: "desconhecida", enabled: "sim" }]
    }, { stepRegistry: registry() }),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      const paths = error.issues.map((issue) => issue.path);
      assert.ok(paths.includes("name"));
      assert.ok(paths.includes("targeting.maxTargets"));
      assert.ok(paths.includes("targeting.range"));
      assert.ok(paths.includes("targeting.blockOutOfRange"));
      assert.ok(paths.includes("variables"));
      assert.ok(paths.includes("steps.0.type"));
      assert.ok(paths.includes("steps.0.enabled"));
      return true;
    }
  );
});

test("não altera o objeto fornecido pelo chamador", () => {
  const input = {
    schemaVersion: 2,
    name: "  Original  ",
    targeting: { source: "none", mode: "none" },
    variables: {},
    steps: []
  };
  const normalized = ProjectValidator.normalize(input);

  assert.equal(input.name, "  Original  ");
  assert.equal(input.targeting.minTargets, undefined);
  assert.equal(normalized.name, "Original");
});

test("normaliza opções de rolagem e componentes de dano", () => {
  const normalized = ProjectValidator.normalize({
    name: "Combate",
    targeting: { source: "none", mode: "none" },
    steps: [
      { type: "attack", formula: "1d20", defense: "17", rollMode: "gmroll" },
      { type: "damage", parts: [{ formula: "1d6", type: "fogo", criticalMultiplier: "2" }] }
    ]
  }, { stepRegistry: createCoreStepRegistry() });

  assert.equal(normalized.steps[0].defense, 17);
  assert.equal(normalized.steps[1].parts[0].criticalMultiplier, 2);
});

test("rejeita fórmulas, eventos e modos de rolagem inválidos", () => {
  assert.throws(() => ProjectValidator.normalize({
    name: "Inválido",
    targeting: { source: "none", mode: "none" },
    steps: [{ type: "attack", formula: "", event: "onUnknown", rollMode: "secret" }]
  }, { stepRegistry: createCoreStepRegistry() }), (error) => {
    const paths = error.issues.map((issue) => issue.path);
    assert.ok(paths.includes("steps.0.formula"));
    assert.ok(paths.includes("steps.0.event"));
    assert.ok(paths.includes("steps.0.rollMode"));
    return true;
  });
});

test("preserva condições e ramificações aninhadas com IDs estáveis", () => {
  const normalized = ProjectValidator.normalize({
    name: "Árvore",
    targeting: { source: "none", mode: "none" },
    steps: [{
      type: "branch",
      condition: {
        type: "group",
        operator: "and",
        children: [
          { type: "critical" },
          { type: "variable", key: "poison", operator: "eq", value: "purple" }
        ]
      },
      then: [{ type: "wait", ms: 10 }],
      else: []
    }]
  }, { stepRegistry: createCoreStepRegistry() });
  const reopened = ProjectValidator.normalize(normalized, { stepRegistry: createCoreStepRegistry() });

  assert.match(normalized.id, /^project-/);
  assert.equal(reopened.id, normalized.id);
  assert.equal(reopened.steps[0].id, normalized.steps[0].id);
  assert.equal(reopened.steps[0].then[0].id, normalized.steps[0].then[0].id);
  assert.deepEqual(reopened.steps[0].condition, normalized.steps[0].condition);
});

test("rejeita condições que tentam armazenar código arbitrário", () => {
  assert.throws(() => ProjectValidator.normalize({
    name: "Código",
    targeting: { source: "none", mode: "none" },
    steps: [{ type: "wait", ms: 1, conditions: [{ type: "javascript", code: "return true" }] }]
  }, { stepRegistry: createCoreStepRegistry() }), (error) => {
    assert.ok(error.issues.some((issue) => issue.path === "steps.0.conditions.0.type"));
    return true;
  });
});

test("normaliza a limpeza opcional de alvos e rejeita valor inválido", () => {
  const project = ProjectValidator.normalize({
    name: "Alvos",
    targeting: { clearTargetsAfterExecution: true },
    variables: {},
    steps: []
  });
  assert.equal(project.targeting.clearTargetsAfterExecution, true);
  assert.throws(() => ProjectValidator.normalize({
    name: "Alvos",
    targeting: { clearTargetsAfterExecution: "sim" },
    variables: {},
    steps: []
  }), ProjectValidationError);
});
test("valida as etapas opcionais de asset e invocação", () => {
  const project = ProjectValidator.normalize({
    name: "Integrações",
    targeting: { source: "none", mode: "none" },
    steps: [
      { type: "assetPreset", presetUuid: "Preset.asset", destination: "location", snapToGrid: true },
      { type: "summon", actorId: "actor-id", count: "2", destination: "source", disposition: "1", visageId: "mask-id" }
    ]
  }, { stepRegistry: createCoreStepRegistry() });

  assert.equal(project.steps[1].count, 2);
  assert.equal(project.steps[1].disposition, 1);
  assert.throws(() => ProjectValidator.normalize({
    name: "Inválido",
    targeting: { source: "none", mode: "none" },
    steps: [
      { type: "assetPreset" },
      { type: "summon", count: 0 }
    ]
  }, { stepRegistry: createCoreStepRegistry() }), ProjectValidationError);
});
test("valida a etapa opcional Token Magic FX", () => {
  const project = ProjectValidator.normalize({
    name: "Efeito",
    variables: {},
    steps: [{
      type: "tokenMagic",
      destination: "target",
      operation: "add",
      filters: '[{"filterType":"glow","filterId":"aura","color":65280}]'
    }]
  }, { stepRegistry: createCoreStepRegistry() });
  assert.equal(project.steps[0].type, "tokenMagic");

  assert.throws(() => ProjectValidator.normalize({
    name: "Efeito",
    variables: {},
    steps: [{ type: "tokenMagic", destination: "location", operation: "remove" }]
  }, { stepRegistry: createCoreStepRegistry() }), ProjectValidationError);
});
test("valida a etapa Modificar token e bloqueia Recursos", () => {
  const project = ProjectValidator.normalize({
    name: "Token da cena",
    targeting: { source: "none", mode: "none" },
    steps: [{
      type: "modifyToken",
      scope: "targets",
      changes: { name: "Sombra", alpha: "0.4", sight: { enabled: true, range: "12" }, light: { bright: 6 } }
    }]
  }, { stepRegistry: createCoreStepRegistry() });

  assert.equal(project.steps[0].changes.alpha, 0.4);
  assert.equal(project.steps[0].changes.sight.range, 12);
  assert.throws(() => ProjectValidator.normalize({
    name: "Recursos",
    targeting: { source: "none", mode: "none" },
    steps: [{ type: "modifyToken", changes: { bar1: { attribute: "hp" } } }]
  }, { stepRegistry: createCoreStepRegistry() }), ProjectValidationError);
});
test("valida Visage global e exige token para Visage local", () => {
  const project = ProjectValidator.normalize({
    name: "Visage",
    targeting: { source: "none", mode: "none" },
    steps: [{ type: "applyVisage", mode: "global", scope: "targets", visageId: "global-form" }]
  }, { stepRegistry: createCoreStepRegistry() });
  assert.equal(project.steps[0].scope, "targets");

  assert.throws(() => ProjectValidator.normalize({
    name: "Visage local",
    targeting: { source: "none", mode: "none" },
    steps: [{ type: "applyVisage", mode: "local", visageId: "local-form" }]
  }, { stepRegistry: createCoreStepRegistry() }), ProjectValidationError);
});
test("aceita variável no limiar crítico e rejeita texto arbitrário", () => {
  const project = ProjectValidator.normalize({
    name: "Crítico variável",
    targeting: { source: "none", mode: "none" },
    variables: { CRITICO: 19 },
    steps: [{ type: "attack", formula: "1d20", criticalThreshold: "@CRITICO" }]
  }, { stepRegistry: createCoreStepRegistry() });
  assert.equal(project.steps[0].criticalThreshold, "@CRITICO");

  assert.throws(() => ProjectValidator.normalize({
    name: "Crítico inválido",
    targeting: { source: "none", mode: "none" },
    variables: {},
    steps: [{ type: "attack", formula: "1d20", criticalThreshold: "20 + FOR" }]
  }, { stepRegistry: createCoreStepRegistry() }), ProjectValidationError);
});
test("valida estilos textuais do menu", () => {
  const project = ProjectValidator.normalize({
    name: "Menu estilizado",
    variables: {},
    steps: [{
      type: "menu",
      titleStyle: { font: "Georgia", size: "22", color: "#ffcc00", bold: true, align: "center" },
      descriptionStyle: { italic: true },
      columnSettings: { 1: { title: "Ações", titleStyle: { size: 18, underline: true } } },
      options: [{ label: "Atacar", value: "attack" }]
    }]
  });
  assert.equal(project.steps[0].titleStyle.size, 22);
  assert.equal(project.steps[0].columnSettings[1].titleStyle.size, 18);

  assert.throws(() => ProjectValidator.normalize({
    name: "Menu inválido",
    variables: {},
    steps: [{ type: "menu", titleStyle: { color: "blue" }, options: [{ label: "A", value: "a" }] }]
  }), ProjectValidationError);
});
test("valida a etapa Pedir valor e seus modos de salvamento", () => {
  const project = ProjectValidator.normalize({
    name: "Resposta",
    targeting: { source: "none", mode: "none" },
    variables: { FOR: 4 },
    steps: [{
      type: "promptVariable",
      variable: "FOR",
      title: "Novo bônus",
      description: "Informe o bônus.",
      inputLabel: "FOR",
      valueType: "number",
      saveMode: "permanent",
      cancelBehavior: "continue"
    }]
  }, { stepRegistry: createCoreStepRegistry() });
  assert.equal(project.steps[0].saveMode, "permanent");

  assert.throws(() => ProjectValidator.normalize({
    name: "Resposta inválida",
    variables: {},
    steps: [{ type: "promptVariable", variable: "FOR", valueType: "date", saveMode: "world" }]
  }, { stepRegistry: createCoreStepRegistry() }), ProjectValidationError);
});
test("valida a etapa Mover token", () => {
  const project = ProjectValidator.normalize({
    name: "Avanço",
    targeting: { source: "controlled", mode: "point" },
    steps: [{ type: "moveToken", scope: "source", destination: "location", mode: "move", snapToGrid: false }]
  }, { stepRegistry: createCoreStepRegistry() });
  assert.deepEqual(project.steps[0], {
    type: "moveToken", scope: "source", destination: "location", mode: "move", snapToGrid: false, id: project.steps[0].id
  });

  assert.throws(() => ProjectValidator.normalize({
    name: "Inválido",
    targeting: { source: "none", mode: "none" },
    steps: [{ type: "moveToken", scope: "other", destination: "elsewhere", mode: "slide" }]
  }, { stepRegistry: createCoreStepRegistry() }), ProjectValidationError);
});