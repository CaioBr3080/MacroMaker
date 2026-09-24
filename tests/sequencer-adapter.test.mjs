import test from "node:test";
import assert from "node:assert/strict";
import { SequencerAdapter } from "../src/integrations/sequencer-adapter.js";

function installSequencerMock(existing = []) {
  const calls = [];
  class Section {
    constructor(kind) {
      this.kind = kind;
    }

    call(method, ...args) {
      calls.push([this.kind, method, ...args]);
      return this;
    }

    file(...args) { return this.call("file", ...args); }
    atLocation(...args) { return this.call("atLocation", ...args); }
    name(...args) { return this.call("name", ...args); }
    attachTo(...args) { return this.call("attachTo", ...args); }
    stretchTo(...args) { return this.call("stretchTo", ...args); }
    scaleToObject(...args) { return this.call("scaleToObject", ...args); }
    scale(...args) { return this.call("scale", ...args); }
    opacity(...args) { return this.call("opacity", ...args); }
    tint(...args) { return this.call("tint", ...args); }
    rotate(...args) { return this.call("rotate", ...args); }
    rotateTowards(...args) { return this.call("rotateTowards", ...args); }
    playbackRate(...args) { return this.call("playbackRate", ...args); }
    belowTokens(...args) { return this.call("belowTokens", ...args); }
    randomRotation(...args) { return this.call("randomRotation", ...args); }
    mirrorX(...args) { return this.call("mirrorX", ...args); }
    mirrorY(...args) { return this.call("mirrorY", ...args); }
    persist(...args) { return this.call("persist", ...args); }
    duration(...args) { return this.call("duration", ...args); }
    loopOptions(...args) { return this.call("loopOptions", ...args); }
    origin(...args) { return this.call("origin", ...args); }
    fadeIn(...args) { return this.call("fadeIn", ...args); }
    fadeOut(...args) { return this.call("fadeOut", ...args); }
    volume(...args) { return this.call("volume", ...args); }
    fadeInAudio(...args) { return this.call("fadeInAudio", ...args); }
    fadeOutAudio(...args) { return this.call("fadeOutAudio", ...args); }
  }

  globalThis.Sequence = class {
    constructor(options) {
      calls.push(["sequence", "constructor", options]);
    }

    effect() { return new Section("effect"); }
    sound() { return new Section("sound"); }
    async play() { calls.push(["sequence", "play"]); }
  };
  globalThis.Sequencer = {
    EffectManager: {
      getEffects(filters) { calls.push(["manager", "getEffects", filters]); return existing; },
      async endEffects(filters) { calls.push(["manager", "endEffects", filters]); }
    }
  };
  return calls;
}

function clearSequencerMock() {
  delete globalThis.Sequence;
  delete globalThis.Sequencer;
}

test("encadeia animação persistente com a assinatura atual do Sequencer", async (t) => {
  t.after(clearSequencerMock);
  const calls = installSequencerMock();
  const source = { id: "source" };
  const target = { id: "target" };
  const context = {
    macro: { id: "macro-id" },
    project: { id: "project-id" },
    resolveLocation: (reference) => reference === "source" ? source : target,
    distanceTo: () => 3
  };

  await SequencerAdapter.playAnimation({
    file: "jb2a.test",
    source: "source",
    target: "target",
    stretchTo: true,
    persist: true,
    persistOptions: { persistTokenPrototype: true },
    id: "step-id",
    name: "aura",
    fadeIn: 100,
    fadeOut: 200
  }, context);

  assert.deepEqual(calls.find((call) => call[1] === "persist"), [
    "effect",
    "persist",
    true,
    { persistTokenPrototype: true }
  ]);
  assert.deepEqual(calls.find((call) => call[1] === "name"), [
    "effect",
    "name",
    "macro-maker.project-id.step-id.aura.untagged"
  ]);
  assert.deepEqual(calls.find((call) => call[1] === "stretchTo"), [
    "effect",
    "stretchTo",
    target,
    {}
  ]);
  assert.deepEqual(calls.at(-1), ["sequence", "play"]);
});

test("encadeia volume e fades de som", async (t) => {
  t.after(clearSequencerMock);
  const calls = installSequencerMock();

  await SequencerAdapter.playSound({
    file: "sounds/hit.ogg",
    volume: 0.4,
    fadeIn: 50,
    fadeOut: 75
  });

  assert.ok(calls.some((call) => call[0] === "sound" && call[1] === "volume" && call[2] === 0.4));
  assert.ok(calls.some((call) => call[0] === "sound" && call[1] === "fadeInAudio" && call[2] === 50));
  assert.ok(calls.some((call) => call[0] === "sound" && call[1] === "fadeOutAudio" && call[2] === 75));
});

test("remove somente o persistente nomeado no objeto escolhido", async (t) => {
  t.after(clearSequencerMock);
  const calls = installSequencerMock();
  const target = { id: "target" };

  await SequencerAdapter.removePersistent({ object: "target", name: "aura" }, {
    macro: { id: "macro-id" },
    project: { id: "project-id" },
    resolveLocation: () => target
  });

  assert.deepEqual(calls.at(-1), ["manager", "endEffects", {
    object: target,
    name: "macro-maker.project-id.*.aura.*"
  }]);
});

test("substitui duplicata no mesmo alvo e converte rodadas em duração", async (t) => {
  t.after(() => { clearSequencerMock(); delete globalThis.CONFIG; });
  const calls = installSequencerMock([{ id: "existing" }]);
  globalThis.CONFIG = { time: { roundTime: 6 } };
  const source = { id: "source", document: { uuid: "Scene.s.Token.source" } };
  const target = { id: "target", document: { uuid: "Scene.s.Token.target" } };
  const context = {
    macro: { id: "macro-id", uuid: "Macro.macro-id" },
    project: { id: "project-id" },
    resolveLocation: (reference) => reference === "target" ? target : source,
    distanceTo: () => 1
  };

  await SequencerAdapter.playAnimation({
    id: "step-id",
    label: "Aura",
    file: "jb2a.test",
    persist: true,
    duplicatePolicy: "replace",
    attachTo: "target",
    durationRounds: 2
  }, context);

  assert.ok(calls.some((call) => call[0] === "manager" && call[1] === "endEffects" && call[2].object === target));
  assert.deepEqual(calls.find((call) => call[1] === "duration"), ["effect", "duration", 12000]);
  assert.deepEqual(calls.find((call) => call[1] === "loopOptions"), ["effect", "loopOptions", { loops: 1, endOnLastLoop: true }]);
  assert.deepEqual(calls.find((call) => call[1] === "origin"), ["effect", "origin", "Scene.s.Token.target"]);
});

test("remoção por alvo não usa o executante", async (t) => {
  t.after(clearSequencerMock);
  const calls = installSequencerMock();
  const source = { id: "source" };
  const target = { id: "target" };
  await SequencerAdapter.removePersistent({ scope: "target" }, {
    project: { id: "project-id" },
    resolveLocation: (reference) => reference === "target" ? target : source
  });

  assert.deepEqual(calls.at(-1), ["manager", "endEffects", { name: "macro-maker.*", target }]);
});

test("mantém a escala, orientação e esticamento condicional", async (t) => {
  t.after(clearSequencerMock);
  const calls = installSequencerMock();
  const source = { id: "source", center: { x: 10, y: 10 } };
  const target = { id: "target", center: { x: 110, y: 10 } };
  let distance = 4;
  const context = {
    resolveLocation: (reference) => reference === "target" ? target : source,
    distanceTo: () => distance
  };
  const step = {
    file: "jb2a.test",
    source: "source",
    target: "target",
    scale: 1.5,
    rotation: 20,
    rotateTowardsTarget: true,
    stretchTo: false,
    distanceBehavior: { stretchAfter: 5 }
  };

  await SequencerAdapter.playAnimation(step, context);

  assert.ok(!calls.some((call) => call[1] === "stretchTo"));
  assert.deepEqual(calls.find((call) => call[1] === "scale"), ["effect", "scale", 1.5]);
  assert.deepEqual(calls.find((call) => call[1] === "rotateTowards"), [
    "effect",
    "rotateTowards",
    target,
    { rotationOffset: 20 }
  ]);
  assert.ok(!calls.some((call) => call[1] === "rotate"));

  calls.length = 0;
  distance = 6;
  await SequencerAdapter.playAnimation(step, context);

  assert.deepEqual(calls.find((call) => call[1] === "stretchTo"), ["effect", "stretchTo", target, {}]);
  assert.ok(!calls.some((call) => call[1] === "scale" || call[1] === "scaleToObject"));
  assert.ok(!calls.some((call) => call[1] === "rotateTowards" || call[1] === "rotate"));
});