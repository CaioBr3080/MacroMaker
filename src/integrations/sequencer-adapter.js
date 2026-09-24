import { MODULE_ID } from "../constants.js";
import { slug } from "../utils/ids.js";

function canvasPoint(location) {
  const point = location?.center ?? location;
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : location;
}

export class SequencerAdapter {
  static assertReady() {
    if (!globalThis.Sequence || !globalThis.Sequencer) {
      throw new Error("O módulo Sequencer precisa estar ativo.");
    }
  }

  static async playAnimation(step, context) {
    this.assertReady();
    const source = context.resolveLocation(step.source ?? "source");
    const target = context.resolveLocation(step.target ?? "target");
    const effectName = step.persist || step.name ? this.persistentName(step, context) : undefined;
    const attached = typeof step.attachTo === "string"
      ? context.resolveLocation(step.attachTo)
      : step.attachTo ? source : null;

    if (step.persist && effectName) {
      const filters = { name: effectName, ...((attached ?? source) ? { object: attached ?? source } : {}) };
      const duplicatePolicy = step.duplicatePolicy ?? "replace";
      const existing = Sequencer.EffectManager.getEffects?.(filters) ?? [];
      if (duplicatePolicy === "skip" && existing.length) return;
      if (duplicatePolicy === "replace" && existing.length) await Sequencer.EffectManager.endEffects(filters);
    }

    const sequence = new Sequence({ moduleName: MODULE_ID, softFail: true });
    const effect = sequence.effect().file(step.file);

    if (source) effect.atLocation(source);
    if (effectName) effect.name(effectName);
    if (attached) effect.attachTo(attached, step.attachOptions ?? {});

    const distance = context.distanceTo(target);
    const stretchThreshold = Number(step.distanceBehavior?.stretchAfter);
    const shouldStretch = Boolean(target) && (
      step.stretchTo === true
      || (Number.isFinite(stretchThreshold) && distance > stretchThreshold)
    );

    if (shouldStretch) {
      // Sequencer owns the scale and orientation while it stretches to the target.
      effect.stretchTo(target, step.stretchOptions ?? {});
    } else {
      if (step.scaleToObject != null && source) effect.scaleToObject(Number(step.scaleToObject), { uniform: true });
      else if (step.scale != null) effect.scale(Number(step.scale));

      if (step.rotateTowardsTarget && target) {
        const rotationOffset = Number(step.rotation);
        effect.rotateTowards(canvasPoint(target), Number.isFinite(rotationOffset) ? { rotationOffset } : {});
      } else if (step.rotation != null) effect.rotate(Number(step.rotation));
    }

    if (step.opacity != null) effect.opacity(Number(step.opacity));
    if (step.tint) effect.tint(step.tint);
    if (step.playbackRate != null) effect.playbackRate(Number(step.playbackRate));
    if (step.belowTokens) effect.belowTokens();
    if (step.randomRotation) effect.randomRotation();
    if (step.mirrorX) effect.mirrorX();
    if (step.mirrorY) effect.mirrorY();
    if (step.persist) effect.persist(true, step.persistOptions ?? {});
    const duration = this.#durationMilliseconds(step);
    if (duration != null) {
      effect.duration(duration);
      if (step.persist) effect.loopOptions({ loops: 1, endOnLastLoop: true });
    }
    const origin = this.#origin(step, context);
    if (origin) effect.origin(origin);
    if (step.fadeIn) effect.fadeIn(Number(step.fadeIn));
    if (step.fadeOut) effect.fadeOut(Number(step.fadeOut));

    await sequence.play();
  }

  static async playSound(step) {
    this.assertReady();
    const sequence = new Sequence({ moduleName: MODULE_ID, softFail: true });
    const sound = sequence.sound().file(step.file);
    if (step.volume != null) sound.volume(Number(step.volume));
    if (step.fadeIn) sound.fadeInAudio(Number(step.fadeIn));
    if (step.fadeOut) sound.fadeOutAudio(Number(step.fadeOut));
    await sequence.play();
  }

  static async removePersistent(step, context) {
    this.assertReady();
    const scope = step.scope ?? (step.name ? "name" : step.object ?? "target");
    const projectId = slug(context.project?.id ?? context.macro?.id, "project");
    const filters = {};
    if (scope === "step") filters.name = `${MODULE_ID}.${projectId}.${slug(step.stepId, "step")}.*`;
    else if (scope === "name") filters.name = `${MODULE_ID}.${projectId}.*.${slug(step.name)}.*`;
    else if (scope === "project") filters.name = `${MODULE_ID}.${projectId}.*`;
    else if (scope === "tag") filters.name = `${MODULE_ID}.*.*.*.*${slug(step.tag)}*`;
    else filters.name = `${MODULE_ID}.*`;

    if (scope === "source" || scope === "target") filters[scope] = context.resolveLocation(scope);
    else if (step.object) filters.object = context.resolveLocation(step.object);
    if (step.sceneId) filters.sceneId = step.sceneId;
    await Sequencer.EffectManager.endEffects(filters);
  }

  static persistentName(step, context) {
    const projectId = slug(context.project?.id ?? context.macro?.id, "project");
    const stepId = slug(step.id, "step");
    const logicalName = slug(step.name ?? step.label, "effect");
    const tags = (Array.isArray(step.tags) ? step.tags : String(step.tags ?? "").split(","))
      .map((tag) => slug(tag, ""))
      .filter(Boolean)
      .join("_") || "untagged";
    return `${MODULE_ID}.${projectId}.${stepId}.${logicalName}.${tags}`;
  }

  static #durationMilliseconds(step) {
    const seconds = Number(step.durationSeconds);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const rounds = Number(step.durationRounds);
    if (!Number.isFinite(rounds) || rounds <= 0) return null;
    const roundSeconds = Number(globalThis.CONFIG?.time?.roundTime ?? 6);
    return rounds * roundSeconds * 1000;
  }

  static #origin(step, context) {
    if (step.linkUuid) return step.linkUuid;
    const reference = step.link ?? step.attachTo;
    const document = context.resolveLocation(reference)?.document ?? context.resolveLocation(reference);
    return document?.uuid ?? context.macro?.uuid ?? null;
  }
}
