import test from "node:test";
import assert from "node:assert/strict";
import { ProjectValidationError, ProjectValidator } from "../src/validation/project-validator.js";
import { StepRegistry } from "../src/execution/step-registry.js";

function registry() {
  return new StepRegistry().register("custom", {
    defaults: {},
    execute: async () => {}
  });
}

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

  assert.equal(project.schemaVersion, 1);
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
      schemaVersion: 1,
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
    schemaVersion: 1,
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
