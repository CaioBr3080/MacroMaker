import test from "node:test";
import assert from "node:assert/strict";
import { SequencerAdapter } from "../src/integrations/sequencer-adapter.js";

function installSequencerMock() {
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
    playbackRate(...args) { return this.call("playbackRate", ...args); }
    belowTokens(...args) { return this.call("belowTokens", ...args); }
    randomRotation(...args) { return this.call("randomRotation", ...args); }
    mirrorX(...args) { return this.call("mirrorX", ...args); }
    mirrorY(...args) { return this.call("mirrorY", ...args); }
    persist(...args) { return this.call("persist", ...args); }
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
    location: (reference) => reference === "source" ? source : target,
    distanceTo: () => 3
  };

  await SequencerAdapter.playAnimation({
    file: "jb2a.test",
    source: "source",
    target: "target",
    stretchTo: true,
    persist: true,
    persistOptions: { persistTokenPrototype: true },
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
    "macro-maker.macro-id.aura"
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
    location: () => target
  });

  assert.deepEqual(calls.at(-1), ["manager", "endEffects", {
    object: target,
    name: "macro-maker.macro-id.aura"
  }]);
});
