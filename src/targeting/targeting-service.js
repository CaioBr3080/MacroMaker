import { TARGET_MODES } from "../constants.js";
import { CanvasPointPicker } from "./canvas-point-picker.js";
import { CanvasTargetPicker } from "./canvas-target-picker.js";
import { TargetGeometry } from "./target-geometry.js";

export class TargetingService {
  static async resolve(targeting = {}, { source = null } = {}) {
    const mode = targeting.mode ?? TARGET_MODES.CURRENT_TARGETS;
    let targets = [];
    let location = null;
    let template = null;

    if (mode === TARGET_MODES.CURRENT_TARGETS) targets = [...game.user.targets];
    else if (mode === TARGET_MODES.CONTROLLED) targets = [...canvas.tokens.controlled].filter((token) => token !== source);
    else if (mode === TARGET_MODES.TOKEN) {
      const result = await CanvasTargetPicker.pick(targeting);
      if (result.cancelled) return { cancelled: true, targets: [], location: null, template: null };
      targets = result.targets;
    } else if ([TARGET_MODES.POINT, TARGET_MODES.CIRCLE, TARGET_MODES.CONE, TARGET_MODES.LINE].includes(mode)) {
      const result = await CanvasPointPicker.pick({
        source,
        range: targeting.range,
        blockOutOfRange: targeting.blockOutOfRange,
        label: this.#labelForMode(mode)
      });
      if (result.cancelled) return { cancelled: true, targets: [], location: null, template: null };
      location = result.point;
      targets = this.#targetsForShape(mode, result.point, targeting, source);
    } else if (mode === TARGET_MODES.TEMPLATE) {
      template = canvas.templates?.controlled?.[0] ?? null;
      if (!template) throw new Error("Selecione um template medido.");
      location = { x: template.document.x, y: template.document.y };
      targets = this.#targetsInTemplate(template);
    } else if (mode !== TARGET_MODES.NONE) {
      throw new Error(`Modo de targeting desconhecido: ${mode}.`);
    }

    const relationshipModes = [
      TARGET_MODES.CURRENT_TARGETS,
      TARGET_MODES.CONTROLLED,
      TARGET_MODES.TOKEN,
      TARGET_MODES.CIRCLE,
      TARGET_MODES.CONE,
      TARGET_MODES.LINE,
      TARGET_MODES.TEMPLATE
    ];
    if (relationshipModes.includes(mode) && targeting.filter && targeting.filter !== "all" && !source) {
      throw new Error("Selecione o token executante para filtrar aliados ou inimigos.");
    }
    targets = TargetGeometry.filterTokens(targets, { source, filter: targeting.filter });
    return { cancelled: false, targets, location, template };
  }

  static #targetsForShape(mode, point, targeting, source) {
    if (mode === TARGET_MODES.POINT) return [];
    const pixelsPerUnit = canvas.grid.size / (Number(canvas.grid.distance) || 1);
    const tokens = canvas.tokens.placeables;
    if (mode === TARGET_MODES.CIRCLE) {
      const shape = { center: point, radius: Number(targeting.radius) * pixelsPerUnit };
      return tokens.filter((token) => TargetGeometry.pointInCircle(token.center, shape));
    }
    if (!source) throw new Error("Selecione o token executante para usar cone ou linha.");
    if (mode === TARGET_MODES.CONE) {
      const direction = Math.atan2(point.y - source.center.y, point.x - source.center.x) * 180 / Math.PI;
      const shape = {
        origin: source.center,
        radius: Number(targeting.radius) * pixelsPerUnit,
        direction,
        angle: Number(targeting.angle)
      };
      return tokens.filter((token) => TargetGeometry.pointInCone(token.center, shape));
    }
    const shape = {
      origin: source.center,
      destination: point,
      width: Number(targeting.width) * pixelsPerUnit
    };
    return tokens.filter((token) => TargetGeometry.pointInLine(token.center, shape));
  }

  static #targetsInTemplate(template) {
    return canvas.tokens.placeables.filter((token) => {
      const x = token.center.x - template.document.x;
      const y = token.center.y - template.document.y;
      return template.shape?.contains?.(x, y) === true;
    });
  }

  static #labelForMode(mode) {
    return {
      [TARGET_MODES.POINT]: "Escolha um ponto",
      [TARGET_MODES.CIRCLE]: "Escolha o centro do círculo",
      [TARGET_MODES.CONE]: "Escolha a direção do cone",
      [TARGET_MODES.LINE]: "Escolha o final da linha"
    }[mode] ?? "Escolha uma posição";
  }
}
