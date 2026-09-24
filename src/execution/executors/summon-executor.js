import { MODULE_ID, PROJECT_FLAG } from "../../constants.js";
import { ProjectRepository } from "../../services/project-repository.js";

const SOCKET_EVENT = "module." + MODULE_ID;
const MAX_SUMMONS = 20;

function documentId(value) {
  return value?.document?.id ?? value?.id ?? null;
}

function asPoint(value) {
  const point = value?.center ?? value;
  if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) return null;
  return { x: Number(point.x), y: Number(point.y) };
}

function locationFor(step, context) {
  return asPoint(context.resolveLocation?.(step.destination ?? "location"))
    ?? asPoint(context.location)
    ?? asPoint(context.target)
    ?? asPoint(context.source);
}

function activeGM() {
  return globalThis.game?.users?.activeGM
    ?? [...(globalThis.game?.users?.contents ?? [])].find((user) => user.active && user.isGM)
    ?? null;
}

function userCanExecute(macro, project, user) {
  if (!user) return false;
  if (user.isGM) return true;
  const observer = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  return project?.sharing?.observerCanExecute !== false
    && macro.testUserPermission?.(user, observer) === true;
}

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
}

function tokenPosition(point, prototype, index, count) {
  const size = gridSize();
  const width = Number(prototype.width ?? 1);
  const height = Number(prototype.height ?? 1);
  const shift = index - ((count - 1) / 2);
  return {
    x: Math.round(point.x - (size * width / 2) + (shift * size)),
    y: Math.round(point.y - (size * height / 2))
  };
}

export class SummonExecutor {
  static registered = false;

  static registerSocket() {
    if (this.registered || !globalThis.game?.socket) return;
    game.socket.on(SOCKET_EVENT, (payload, senderId) => this.#receive(payload, senderId));
    this.registered = true;
  }

  static async execute(step, context) {
    if (game.user.isGM) return this.#create(step, context);

    const gm = activeGM();
    if (!gm) throw new Error("Nenhum GM ativo pode criar o token invocado.");
    const location = locationFor(step, context);
    if (!location) throw new Error("Escolha uma origem, alvo ou ponto para invocar o token.");

    game.socket.emit(SOCKET_EVENT, {
      action: "summon",
      macroUuid: context.macro?.uuid,
      stepId: step.id,
      sceneId: canvas.scene?.id,
      sourceId: documentId(context.source),
      targetId: documentId(context.target),
      location,
      requesterId: game.user.id
    });
    ui.notifications.info("Invocação enviada ao GM.");
    return { requested: true };
  }

  static async #receive(payload, senderId) {
    if (payload?.action !== "summon" || !game.user.isGM || game.user.id !== activeGM()?.id) return;
    const requester = game.users.get(senderId ?? payload.requesterId);
    if (!requester) return;

    try {
      const { macro, project } = await ProjectRepository.get(payload.macroUuid);
      if (!userCanExecute(macro, project, requester)) {
        throw new Error("O solicitante não possui permissão para executar este Macro Maker.");
      }
      const step = this.#findStep(project.steps, payload.stepId);
      if (!step || step.type !== "summon") throw new Error("A etapa de invocação solicitada não existe mais.");

      const scene = game.scenes.get(payload.sceneId);
      if (!scene) throw new Error("A cena da invocação não está disponível.");
      const source = payload.sourceId ? scene.tokens.get(payload.sourceId) : null;
      if (source?.actor && !source.actor.testUserPermission?.(requester, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
        throw new Error("O solicitante não controla o token de origem.");
      }
      const target = payload.targetId ? scene.tokens.get(payload.targetId) : null;
      await this.#create(step, {
        source: source?.object ?? source,
        target: target?.object ?? target,
        location: asPoint(payload.location),
        resolveLocation(reference) {
          if (reference === "source") return this.source;
          if (reference === "target") return this.target;
          if (reference === "location") return this.location;
          return null;
        },
        macro
      }, scene);
    } catch (error) {
      console.error("Macro Maker | falha na invocação remota", error);
      ui.notifications.warn("A invocação solicitada falhou: " + error.message);
    }
  }

  static #findStep(steps, id) {
    for (const step of steps ?? []) {
      if (step?.id === id) return step;
      const nested = this.#findStep(step?.then, id) ?? this.#findStep(step?.else, id);
      if (nested) return nested;
    }
    return null;
  }

  static async #create(step, context, explicitScene = null) {
    const scene = explicitScene ?? canvas.scene;
    if (!scene) throw new Error("Não há cena ativa para receber a invocação.");
    const actor = game.actors.get(step.actorId);
    if (!actor) throw new Error("Escolha o Ator que será invocado.");
    if (step.visageId && !game.modules.get("visage")?.active) {
      throw new Error("A variação escolhida exige o módulo Visage ativo.");
    }

    const point = locationFor(step, context);
    if (!point) throw new Error("Escolha uma origem, alvo ou ponto para invocar o token.");
    const count = Math.min(MAX_SUMMONS, Math.max(1, Math.floor(Number(step.count ?? 1))));
    const prototype = actor.prototypeToken?.toObject?.() ?? {};
    const name = String(step.tokenName ?? "").trim() || prototype.name || actor.name;
    const documents = Array.from({ length: count }, (_unused, index) => {
      const position = tokenPosition(point, prototype, index, count);
      return {
        ...prototype,
        actorId: actor.id,
        name,
        x: position.x,
        y: position.y,
        hidden: step.hidden === true,
        disposition: Number.isFinite(Number(step.disposition)) ? Number(step.disposition) : 0
      };
    });
    const created = await scene.createEmbeddedDocuments("Token", documents);

    if (step.visageId) {
      const visage = game.modules.get("visage")?.api;
      if (!visage?.apply) throw new Error("A API do Visage não está disponível.");
      for (const token of created) {
        await visage.apply(token.object ?? token, step.visageId);
      }
    }
    return created;
  }
}