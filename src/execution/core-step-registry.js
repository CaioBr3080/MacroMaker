import { STEP_TYPES } from "../constants.js";
import { SequencerAdapter } from "../integrations/sequencer-adapter.js";
import { MenuExecutor } from "./executors/menu-executor.js";
import { RollExecutor } from "./executors/roll-executor.js";
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
      stretchTo: true
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
    defaults: { label: "Ataque", formula: "1d20", criticalThreshold: 20 },
    schema: {},
    execute: (step, context) => RollExecutor.attack(step, context)
  });

  registry.register(STEP_TYPES.DAMAGE, {
    label: "Dano",
    icon: "fas fa-burst",
    defaults: { label: "Dano", formula: "1d6", criticalFormula: "2d6" },
    schema: {},
    execute: (step, context) => RollExecutor.damage(step, context)
  });

  registry.register(STEP_TYPES.MENU, {
    label: "Menu",
    icon: "fas fa-list",
    defaults: {
      label: "Escolha",
      variable: "choice",
      options: [{ label: "Opção A", value: "a" }]
    },
    schema: {},
    execute: (step, context) => MenuExecutor.execute(step, context)
  });

  registry.register(STEP_TYPES.REMOVE_PERSISTENT, {
    label: "Remover persistente",
    icon: "fas fa-eraser",
    defaults: { label: "Remover persistente", object: "target", name: "efeito" },
    schema: {},
    execute: (step, context) => SequencerAdapter.removePersistent(step, context)
  });

  return registry;
}
