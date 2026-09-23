import { ConditionEngine } from "../condition-engine.js";
import { StepRunner } from "../step-runner.js";

export class BranchExecutor {
  static async execute(step, context, stepRegistry) {
    const evaluation = await ConditionEngine.evaluate(step.condition ?? { type: "always" }, context);
    context.recordDebug?.({
      kind: "branch",
      stepId: step.id,
      stepLabel: step.label,
      branch: evaluation.matched ? "then" : "else",
      evaluation
    });
    const selected = evaluation.matched ? step.then : step.else;
    if (!Array.isArray(selected) || !selected.length) return;

    context.enterBranch?.(step);
    try {
      await StepRunner.run(selected, context, stepRegistry, { events: context.runtimeEvents ?? null });
    } finally {
      context.leaveBranch?.();
    }
  }
}
