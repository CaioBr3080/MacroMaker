import { COMPATIBILITY } from "../constants.js";

function parts(version) {
  return String(version ?? "0").split(/[.-]/).slice(0, 3).map((part) => Number(part) || 0);
}

function atLeast(version, minimum) {
  const actual = parts(version);
  const required = parts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] > required[index]) return true;
    if (actual[index] < required[index]) return false;
  }
  return true;
}

export class CompatibilityService {
  report() {
    const foundryVersion = globalThis.game?.version ?? globalThis.game?.release?.version ?? "unknown";
    const sequencerVersion = globalThis.game?.modules?.get?.("sequencer")?.version ?? "unknown";
    return {
      matrix: COMPATIBILITY,
      foundry: {
        version: foundryVersion,
        supported: foundryVersion !== "unknown" && atLeast(foundryVersion, COMPATIBILITY.foundry.minimum),
        verified: String(foundryVersion).split(".")[0] === COMPATIBILITY.foundry.verified
      },
      sequencer: {
        version: sequencerVersion,
        supported: sequencerVersion !== "unknown" && atLeast(sequencerVersion, COMPATIBILITY.sequencer.minimum)
      }
    };
  }
}
