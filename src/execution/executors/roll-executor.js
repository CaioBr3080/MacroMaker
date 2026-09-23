import { ROLL_MODES } from "../../constants.js";
import { ManualHitResolver } from "../manual-hit-resolver.js";
import { RollAnalysis } from "../roll-analysis.js";
import { resolveFormulaVariables } from "../../utils/formula-variables.js";
import { messageFlavor } from "../../utils/message-style.js";
import { escapeHtml, interpolate } from "../../utils/safe-values.js";

export class RollExecutor {
  static async attack(step, context) {
    const roll = await this.#evaluate(step.formula, context);
    const defense = await this.#resolveDefense(step, context);
    const critical = RollAnalysis.isCritical(roll, step, { defense });
    let hit = null;
    if (step.hitMode === "manual") {
      hit = await ManualHitResolver.confirm({ step, context, roll });
      if (hit == null) throw new Error("Execução cancelada durante a confirmação de acerto.");
    } else if (defense != null && Number.isFinite(defense)) {
      hit = Number(roll.total) >= defense;
    }

    const result = this.#record(context, "attack", roll, { critical, hit, defense });
    context.attack = roll;
    context.critical = critical;
    context.hit = hit;
    await this.#toMessage(roll, step, context, "Ataque");
    return result;
  }

  static async test(step, context) {
    return this.#simpleRoll(step, context, "test", "Teste");
  }

  static async generic(step, context) {
    return this.#simpleRoll(step, context, "roll", "Rolagem");
  }

  static async damage(step, context) {
    const parts = this.#parts(step, context.critical);
    const results = [];
    const rolls = [];
    for (const part of parts) {
      const roll = await this.#evaluate(part.formula, context);
      rolls.push(roll);
      const rawTotal = Number(roll.total);
      const resistance = part.type
        ? await context.systems?.getResistance(context.target, part.type, { step, part, context }) ?? null
        : null;
      const total = Number.isFinite(resistance) ? Math.max(0, rawTotal - resistance) : rawTotal;
      results.push(this.#record(context, "damagePart", roll, {
        type: part.type ?? null,
        rawTotal,
        resistance,
        total
      }));
    }
    const summary = {
      kind: "damage",
      total: results.reduce((total, result) => total + result.total, 0),
      parts: results
    };
    context.damage = summary;
    context.lastResult = summary;
    context.variables.damage = summary;
    await this.#componentMessage(rolls, results, parts, step, context, summary, `Dano${context.critical ? " Crítico" : ""}`);
    return summary;
  }

  static async healing(step, context) {
    const parts = step.parts?.length ? step.parts : [{ formula: step.formula, type: step.typeLabel ?? null }];
    const results = [];
    const rolls = [];
    for (const part of parts) {
      const roll = await this.#evaluate(part.formula, context);
      rolls.push(roll);
      results.push(this.#record(context, "healingPart", roll, { type: part.type ?? null }));
    }
    const summary = {
      kind: "healing",
      total: results.reduce((total, result) => total + result.total, 0),
      parts: results
    };
    context.healing = summary;
    context.lastResult = summary;
    context.variables.healing = summary;
    await this.#componentMessage(rolls, results, parts, step, context, summary, "Cura");
    return summary;
  }

  static async #componentMessage(rolls, results, parts, step, context, summary, label) {
    let combined = rolls[0];
    if (rolls.length > 1) {
      const PoolClass = foundry.dice.terms.PoolTerm;
      const RollClass = globalThis.CONFIG?.Dice?.rolls?.[0] ?? globalThis.Roll;
      // Reuse evaluated dice: never evaluate or reroll the components a second time.
      combined = RollClass.fromTerms([PoolClass.fromRolls(rolls)]);
    }
    summary.rawTotal = Number(combined.total);
    summary.formula = combined.formula;
    context.lastRoll = combined;
    context.variables.lastRoll = { kind: summary.kind, formula: summary.formula, total: summary.total };
    const lines = results.map((result, index) => {
      const type = escapeHtml(result.type || label);
      const formula = escapeHtml(result.formula);
      const resistance = Number.isFinite(result.resistance) ? `; resistência ${result.resistance}; final ${result.total}` : "";
      const note = parts[index].flavor ? ` — ${escapeHtml(interpolate(parts[index].flavor, context.variables))}` : "";
      return `<li>${type}: ${formula} = ${result.rawTotal ?? result.total}${resistance}${note}</li>`;
    }).join("");
    const details = `<ul class="macro-maker-roll-components">${lines}</ul><p><strong>Total${summary.total !== summary.rawTotal ? " após resistências" : ""}: ${summary.total}</strong></p>`;
    await this.#toMessage(combined, step, context, label, details, {
      "macro-maker": { kind: summary.kind, total: summary.total, rawTotal: summary.rawTotal, parts: results }
    });
  }

  static async #simpleRoll(step, context, kind, label) {
    const roll = await this.#evaluate(step.formula, context);
    const critical = RollAnalysis.isCritical(roll, step);
    const result = this.#record(context, kind, roll, { critical });
    context.critical = critical;
    await this.#toMessage(roll, step, context, label);
    return result;
  }

  static async #evaluate(formula, context) {
    if (typeof formula !== "string" || !formula.trim()) throw new Error("A fórmula da rolagem está vazia.");
    const RollClass = globalThis.CONFIG?.Dice?.rolls?.[0] ?? globalThis.Roll;
    if (!RollClass) throw new Error("A classe de rolagem do Foundry não está disponível.");
    return new RollClass(resolveFormulaVariables(formula, context.variables), context.variables).evaluate();
  }

  static async #resolveDefense(step, context) {
    if (step.defense != null && step.defense !== "") {
      const defense = Number(step.defense);
      if (!Number.isFinite(defense)) throw new Error("A Defesa configurada não é numérica.");
      return defense;
    }
    return context.systems?.getDefense(context.target, { key: step.defenseKey, step, context }) ?? null;
  }

  static #parts(step, critical) {
    const parts = step.parts?.length ? step.parts : [{
      formula: step.formula,
      criticalFormula: step.criticalFormula,
      criticalMultiplier: step.criticalMultiplier,
      type: step.damageType ?? null
    }];
    return parts.map((part) => ({
      ...part,
      formula: critical ? RollAnalysis.criticalFormula(part, part.formula) : part.formula
    }));
  }

  static #record(context, kind, roll, extra = {}) {
    const result = {
      kind,
      formula: roll.formula,
      total: Number(roll.total),
      ...extra
    };
    context.rolls.push(result);
    context.lastRoll = roll;
    context.lastResult = result;
    context.variables.lastRoll = result;
    context.variables[kind] = result;
    return result;
  }

  static async #toMessage(roll, step, context, fallbackLabel, details = "", flags = {}) {
    const rollMode = step.rollMode ?? context.project.rollMode ?? "publicroll";
    if (!ROLL_MODES.includes(rollMode)) throw new Error(`Modo de rolagem inválido: ${rollMode}.`);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ token: context.source?.document }),
      flavor: messageFlavor(step, `${context.project.name} — ${fallbackLabel}`, context.variables) + details,
      flags
    }, { rollMode });
  }
}
