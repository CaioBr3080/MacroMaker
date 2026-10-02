import test from "node:test";
import assert from "node:assert/strict";
import { installRollChatCompatibility } from "../src/integrations/roll-chat-compatibility.js";

test("chat do Ordem não falha em um d20 agrupado do Macro Maker", (t) => {
  const calls = [];
  class Message {
    _highlightCriticalSuccessFailure(html) {
      calls.push({ message: this, html });
      const die = this.rolls?.[0]?.dice?.[0];
      if (die?.faces === 20 && this.rolls[0].terms[0] !== die) throw new Error("D20 principal indisponível");
      return "decorated";
    }
  }
  globalThis.game = { system: { id: "ordemparanormal" } };
  globalThis.CONFIG = { ChatMessage: { documentClass: Message } };
  t.after(() => { delete globalThis.game; delete globalThis.CONFIG; });
  const die = { faces: 20, values: [17], results: [{ result: 17, active: true }] };
  const message = new Message();
  message.flags = { "macro-maker": { speaker: {} } };
  message.rolls = [{ dice: [die], terms: [{ roll: { dice: [die] } }], total: 42 }];
  const originalRoll = message.rolls[0];
  assert.throws(() => message._highlightCriticalSuccessFailure({}), /D20 principal/);
  calls.length = 0;
  assert.equal(installRollChatCompatibility(), true);
  assert.equal(installRollChatCompatibility(), false);
  assert.doesNotThrow(() => message._highlightCriticalSuccessFailure({}));
  assert.equal(calls.length, 0);
  assert.equal(message.rolls[0], originalRoll);
  assert.equal(message.rolls[0].total, 42);
  assert.deepEqual(message.rolls[0].dice[0].values, [17]);
  message.rolls[0].terms = [die];
  const html = {};
  assert.equal(message._highlightCriticalSuccessFailure(html), "decorated");
  assert.equal(calls[0].message, message);
  assert.equal(calls[0].html, html);
  message.flags = {};
  message.rolls[0].terms = [{}];
  assert.throws(() => message._highlightCriticalSuccessFailure({}), /D20 principal/);
});

test("compatibilidade de chat não interfere em outros sistemas ou APIs ausentes", (t) => {
  globalThis.game = { system: { id: "other" } };
  const original = () => "unchanged";
  class Message {}
  Message.prototype._highlightCriticalSuccessFailure = original;
  globalThis.CONFIG = { ChatMessage: { documentClass: Message } };
  t.after(() => { delete globalThis.game; delete globalThis.CONFIG; });
  assert.equal(installRollChatCompatibility(), false);
  assert.equal(Message.prototype._highlightCriticalSuccessFailure, original);
  game.system.id = "ordemparanormal";
  delete Message.prototype._highlightCriticalSuccessFailure;
  assert.equal(installRollChatCompatibility(), false);
});
