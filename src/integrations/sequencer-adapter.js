import { MODULE_ID } from "../constants.js";

export class SequencerAdapter {
  static assertReady() {
    if (!globalThis.Sequence || !globalThis.Sequencer) {
      throw new Error("O módulo Sequencer precisa estar ativo.");
    }
  }

  static async playAnimation(step, context) {
    this.assertReady();
    const source = context.location(step.source ?? "source");
    const target = context.location(step.target ?? "target");
    const effectName = step.name
      ? `${MODULE_ID}.${context.macro.id}.${step.name}`
      : undefined;

    const sequence = new Sequence({ moduleName: MODULE_ID, softFail: true });
    const effect = sequence.effect().file(step.file);

    if (source) effect.atLocation(source);
    if (effectName) effect.name(effectName);
    if (step.attachTo && source) effect.attachTo(source);

    const distance = context.distanceTo(target);
    const stretchThreshold = Number(step.distanceBehavior?.stretchAfter);
    const shouldStretch = step.stretchTo
      || (Number.isFinite(stretchThreshold) && distance > stretchThreshold);

    if (shouldStretch && target) effect.stretchTo(target, step.stretchOptions ?? {});
    else if (step.scaleToObject && source) effect.scaleToObject(Number(step.scaleToObject), { uniform: true });
    else if (step.scale != null) effect.scale(Number(step.scale));

    if (step.opacity != null) effect.opacity(Number(step.opacity));
    if (step.tint) effect.tint(step.tint);
    if (step.rotation != null) effect.rotate(Number(step.rotation));
    if (step.playbackRate != null) effect.playbackRate(Number(step.playbackRate));
    if (step.belowTokens) effect.belowTokens();
    if (step.randomRotation) effect.randomRotation();
    if (step.mirrorX) effect.mirrorX();
    if (step.mirrorY) effect.mirrorY();
    if (step.persist) effect.persist(true, step.persistOptions ?? {});
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
    const object = context.location(step.object ?? "target");
    const name = step.name ? `${MODULE_ID}.${context.macro.id}.${step.name}` : undefined;
    await Sequencer.EffectManager.endEffects({ object, name });
  }
}
