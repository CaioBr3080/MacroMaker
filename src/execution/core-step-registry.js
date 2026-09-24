import { STEP_TYPES } from "../constants.js";
import { SequencerAdapter } from "../integrations/sequencer-adapter.js";
import { MassEditAdapter } from "../integrations/mass-edit-adapter.js";
import { TokenMagicAdapter } from "../integrations/token-magic-adapter.js";
import { SummonExecutor } from "./executors/summon-executor.js";
import { MenuExecutor } from "./executors/menu-executor.js";
import { RollExecutor } from "./executors/roll-executor.js";
import { BranchExecutor } from "./executors/branch-executor.js";
import { RuntimeStepExecutor } from "./executors/runtime-step-executor.js";
import { VariableExecutor } from "./executors/variable-executor.js";
import { PromptVariableExecutor } from "./executors/prompt-variable-executor.js";
import { TokenUpdateExecutor } from "./executors/token-update-executor.js";
import { VisageExecutor } from "./executors/visage-executor.js";
import { StepRegistry } from "./step-registry.js";

export function createCoreStepRegistry() {
  const registry = new StepRegistry();

  registry.register(STEP_TYPES.ANIMATION, {
    label: "Animação",
    icon: "fas fa-film",
    defaults: {
      label: "Nova animação",
      file: "jb2a.",
      source: "source",
      target: "target",
      stretchTo: false,
      rotateTowardsTarget: false,
      persist: false,
      duplicatePolicy: "replace"
    },
    schema: {},
    execute: (step, context) => SequencerAdapter.playAnimation(step, context)
  });

  registry.register(STEP_TYPES.SOUND, {
    label: "Som",
    icon: "fas fa-volume-high",
    defaults: { label: "Novo som", file: "sounds/exemplo.ogg", volume: 0.8 },
    schema: {},
    execute: (step, context) => SequencerAdapter.playSound(step, context)
  });

  registry.register(STEP_TYPES.WAIT, {
    label: "Espera",
    icon: "fas fa-hourglass-half",
    defaults: { label: "Espera", ms: 500 },
    schema: {},
    execute: (step) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(step.ms ?? 0))))
  });

  registry.register(STEP_TYPES.ATTACK, {
    label: "Ataque",
    icon: "fas fa-dice-d20",
    defaults: {
      label: "Ataque",
      formula: "1d20",
      criticalThreshold: 20,
      hitMode: "auto",
      rollMode: "publicroll"
    },
    schema: {},
    execute: (step, context) => RollExecutor.attack(step, context)
  });

  registry.register(STEP_TYPES.TEST, {
    label: "Teste",
    icon: "fas fa-dice-d20",
    defaults: { label: "Teste", formula: "1d20", criticalThreshold: 20, rollMode: "publicroll" },
    schema: {},
    execute: (step, context) => RollExecutor.test(step, context)
  });

  registry.register(STEP_TYPES.DAMAGE, {
    label: "Dano",
    icon: "fas fa-burst",
    defaults: { label: "Dano", formula: "1d6", criticalFormula: "2d6", rollMode: "publicroll" },
    schema: {},
    execute: (step, context) => RollExecutor.damage(step, context)
  });

  registry.register(STEP_TYPES.HEALING, {
    label: "Cura",
    icon: "fas fa-heart",
    defaults: { label: "Cura", formula: "1d8", rollMode: "publicroll" },
    schema: {},
    execute: (step, context) => RollExecutor.healing(step, context)
  });

  registry.register(STEP_TYPES.ROLL, {
    label: "Rolagem genérica",
    icon: "fas fa-dice",
    defaults: { label: "Rolagem", formula: "1d20", rollMode: "publicroll" },
    schema: {},
    execute: (step, context) => RollExecutor.generic(step, context)
  });

  registry.register(STEP_TYPES.MENU, {
    label: "Menu",
    icon: "fas fa-list",
    defaults: {
      label: "Escolha",
      title: "Escolha uma opção",
      description: "",
      selection: "single",
      columns: 1,
      variable: "choice",
      cancelBehavior: "abort",
      options: [{ label: "Opção A", value: "a", description: "", image: "", icon: "" }]
    },
    schema: {},
    execute: (step, context) => MenuExecutor.execute(step, context)
  });

  registry.register(STEP_TYPES.BRANCH, {
    label: "Ramificação",
    icon: "fas fa-code-branch",
    defaults: {
      label: "Se / senão",
      condition: { type: "variable", key: "choice", operator: "eq", value: "a" },
      then: [],
      else: []
    },
    schema: {},
    execute: (step, context) => BranchExecutor.execute(step, context, registry)
  });

  registry.register(STEP_TYPES.SET_VARIABLE, {
    label: "Definir variável",
    icon: "fas fa-square-root-variable",
    defaults: { label: "Definir variável", variable: "value", operation: "set", valueType: "string", value: "" },
    schema: {},
    execute: (step, context) => VariableExecutor.execute(step, context)
  });

  registry.register(STEP_TYPES.PROMPT_VARIABLE, {
    label: "Pedir valor",
    icon: "fas fa-comment-dots",
    defaults: {
      label: "Pedir valor",
      title: "Informar valor",
      description: "",
      inputLabel: "Valor",
      variable: "value",
      valueType: "string",
      saveMode: "execution",
      cancelBehavior: "abort"
    },
    schema: {},
    execute: (step, context) => PromptVariableExecutor.execute(step, context)
  });
  registry.register(STEP_TYPES.MUTATE_STEPS, {
    label: "Alterar etapa nesta execução",
    icon: "fas fa-pen-to-square",
    defaults: {
      label: "Alterar etapa",
      action: "modify",
      targetId: "",
      changes: { enabled: false },
      step: { type: "wait", label: "Espera condicional", ms: 500 }
    },
    schema: {},
    execute: (step, context) => RuntimeStepExecutor.execute(step, context)
  });

  registry.register(STEP_TYPES.REMOVE_PERSISTENT, {
    label: "Remover persistente",
    icon: "fas fa-eraser",
    defaults: { label: "Remover persistente", scope: "name", object: "target", name: "efeito" },
    schema: {},
    execute: (step, context) => SequencerAdapter.removePersistent(step, context)
  });

  registry.register(STEP_TYPES.ASSET_PRESET, {
    label: "Asset do Mass Edit",
    icon: "fas fa-cubes",
    defaults: {
      label: "Asset configurado",
      presetUuid: "",
      presetName: "",
      presetType: "ALL",
      destination: "location",
      pickPosition: true,
      snapToGrid: true,
      hidden: false
    },
    schema: {},
    execute: (step, context) => MassEditAdapter.spawnPreset(step, context)
  });

  registry.register(STEP_TYPES.MODIFY_TOKEN, {
    label: "Modificar token da cena",
    icon: "fas fa-user-gear",
    defaults: {
      label: "Modificar token",
      scope: "target",
      changes: {}
    },
    schema: {},
    execute: (step, context) => TokenUpdateExecutor.execute(step, context)
  });
  registry.register(STEP_TYPES.TOKEN_MAGIC, {
    label: "Efeito Token Magic FX",
    icon: "fas fa-wand-sparkles",
    defaults: {
      label: "Efeito Token Magic",
      destination: "target",
      operation: "add",
      preset: "",
      filters: "",
      filterId: "",
      replace: false
    },
    schema: {},
    execute: (step, context) => TokenMagicAdapter.apply(step, context)
  });

  registry.register(STEP_TYPES.APPLY_VISAGE, {
    label: "Aplicar Visage",
    icon: "fas fa-masks-theater",
    defaults: {
      label: "Aplicar Visage",
      mode: "global",
      scope: "target",
      visageId: "",
      localTokenUuid: ""
    },
    schema: {},
    execute: (step, context) => VisageExecutor.execute(step, context)
  });
  registry.register(STEP_TYPES.SUMMON, {
    label: "Invocar token",
    icon: "fas fa-dragon",
    defaults: {
      label: "Invocar token",
      actorId: "",
      tokenName: "",
      destination: "location",
      count: 1,
      disposition: 0,
      hidden: false,
      snapToGrid: true,
      visageId: ""
    },
    schema: {},
    execute: (step, context) => SummonExecutor.execute(step, context)
  });

  return registry;
}
