import { SCHEMA_VERSION, TARGET_FILTERS, TARGET_MODES } from "../constants.js";
import { createId } from "../utils/ids.js";

export function createDefaultProject(overrides = {}) {
  return foundry.utils.mergeObject({
    id: createId("project"),
    schemaVersion: SCHEMA_VERSION,
    name: "Novo Macro",
    description: "",
    icon: "icons/svg/dice-target.svg",
    targeting: {
      source: "controlled",
      mode: TARGET_MODES.CURRENT_TARGETS,
      filter: TARGET_FILTERS.ALL,
      minTargets: 1,
      maxTargets: 1,
      range: null,
      blockOutOfRange: false,
      radius: 3,
      angle: 90,
      width: 1
    },
    variables: {},
    steps: [],
    sharing: {
      folderId: "",
      userId: "",
      level: 3,
      observerCanExecute: true,
      hotbarSlot: null,
      lockedFields: []
    },
    metadata: {
      createdBy: game.user?.id ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }, overrides, { inplace: false, recursive: true });
}
