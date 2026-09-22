import { SCHEMA_VERSION, TARGET_MODES } from "../constants.js";

export function createDefaultProject(overrides = {}) {
  return foundry.utils.mergeObject({
    schemaVersion: SCHEMA_VERSION,
    name: "Novo Macro",
    description: "",
    icon: "icons/svg/dice-target.svg",
    targeting: {
      source: "controlled",
      mode: TARGET_MODES.CURRENT_TARGETS,
      minTargets: 1,
      maxTargets: 1,
      range: null,
      blockOutOfRange: false
    },
    variables: {},
    steps: [],
    metadata: {
      createdBy: game.user?.id ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }, overrides, { inplace: false, recursive: true });
}
