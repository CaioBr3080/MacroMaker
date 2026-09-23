import { EXECUTION_EVENTS, STEP_TYPES } from "../constants.js";
import { StepRunner } from "./step-runner.js";

export class ExecutionEvents {
  constructor(steps, context, stepRegistry) {
    this.steps = steps;
    this.context = context;
    this.stepRegistry = stepRegistry;
    this.history = [];
  }

  async emit(eventName) {
    if (!EXECUTION_EVENTS.includes(eventName)) throw new Error(`Evento de execução inválido: ${eventName}.`);
    this.history.push(eventName);
    this.context.event = eventName;
    Hooks.callAll(`macroMaker.${eventName}`, { context: this.context, event: eventName });
    await StepRunner.run(this.steps, this.context, this.stepRegistry, { event: eventName });
  }

  async afterStep(step) {
    if (step.type === STEP_TYPES.ATTACK) {
      await this.emit("onAttack");
      if (this.context.hit === true) await this.emit("onHit");
      if (this.context.hit === false) await this.emit("onMiss");
      if (this.context.critical) await this.emit("onCritical");
    }
    if (step.type === STEP_TYPES.DAMAGE) await this.emit("onDamage");
  }
}
