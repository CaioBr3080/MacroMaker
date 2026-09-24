export const MODULE_ID = "macro-maker";
export const PROJECT_FLAG = "project";
export const SCHEMA_VERSION = 2;

export const COMPATIBILITY = Object.freeze({
  foundry: { minimum: "13", verified: "13" },
  sequencer: { minimum: "3.6.0" }
});

export const STEP_TYPES = Object.freeze({
  ANIMATION: "animation",
  SOUND: "sound",
  WAIT: "wait",
  ATTACK: "attack",
  TEST: "test",
  DAMAGE: "damage",
  HEALING: "healing",
  ROLL: "roll",
  MENU: "menu",
  BRANCH: "branch",
  SET_VARIABLE: "setVariable",
  MUTATE_STEPS: "mutateSteps",
  REMOVE_PERSISTENT: "removePersistent",
  ASSET_PRESET: "assetPreset",
  SUMMON: "summon",
  TOKEN_MAGIC: "tokenMagic"
});

export const TARGET_MODES = Object.freeze({
  CURRENT_TARGETS: "currentTargets",
  CONTROLLED: "controlled",
  TOKEN: "token",
  POINT: "point",
  CIRCLE: "circle",
  CONE: "cone",
  LINE: "line",
  TEMPLATE: "template",
  NONE: "none"
});

export const TARGET_FILTERS = Object.freeze({
  ALL: "all",
  ALLY: "ally",
  ENEMY: "enemy"
});

export const EXECUTION_EVENTS = Object.freeze([
  "onStart",
  "onTarget",
  "onAttack",
  "onHit",
  "onMiss",
  "onCritical",
  "onDamage",
  "onEnd"
]);

export const ROLL_MODES = Object.freeze([
  "publicroll",
  "gmroll",
  "blindroll",
  "selfroll"
]);
