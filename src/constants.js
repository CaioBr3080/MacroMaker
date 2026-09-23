export const MODULE_ID = "macro-maker";
export const PROJECT_FLAG = "project";
export const SCHEMA_VERSION = 1;

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
  REMOVE_PERSISTENT: "removePersistent"
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
