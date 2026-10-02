import { MODULE_ID } from "../constants.js";

const INSTALLED = Symbol("macro-maker.roll-chat-compatibility");

export function installRollChatCompatibility() {
  if (globalThis.game?.system?.id !== "ordemparanormal") return false;
  const MessageClass = globalThis.CONFIG?.ChatMessage?.documentClass ?? globalThis.ChatMessage;
  const prototype = MessageClass?.prototype;
  const original = prototype?._highlightCriticalSuccessFailure;
  if (typeof original !== "function" || original[INSTALLED]) return false;

  // Ordem's highlighter converts every single-d20 roll to a D20Roll, whose
  // primary die must be terms[0]. Required parentheses (e.g. ACERTO * 2)
  // violate that assumption and can abort the entire chat render. Skip only
  // that optional system decoration for affected Macro Maker messages, keeping
  // the native tooltip, evaluated dice, formula, visibility and total intact.
  const wrapped = function (...args) {
    const hasNestedPrimaryDie = this.flags?.[MODULE_ID] && this.rolls?.some((roll) => {
      const die = roll.dice?.[0];
      return die?.faces === 20 && die.values?.length === 1 && roll.terms?.[0] !== die;
    });
    if (hasNestedPrimaryDie) return;
    return original.apply(this, args);
  };
  wrapped[INSTALLED] = true;
  prototype._highlightCriticalSuccessFailure = wrapped;
  return true;
}
