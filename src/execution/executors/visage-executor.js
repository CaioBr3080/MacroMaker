import { MODULE_ID } from "../../constants.js";
import { ProjectRepository } from "../../services/project-repository.js";

const SOCKET_EVENT = "module." + MODULE_ID;
const REQUEST_TIMEOUT = 15_000;

function visageApi() {
  const module = globalThis.game?.modules?.get?.("visage");
  return module?.active ? module.api ?? null : null;
}

function activeGM() {
  return globalThis.game?.users?.activeGM
    ?? [...(globalThis.game?.users?.contents ?? [])].find((user) => user.active && user.isGM)
    ?? null;
}

function tokenDocument(target) {
  return target?.document ?? target ?? null;
}

function tokenId(target) {
  return tokenDocument(target)?.id ?? target?.id ?? null;
}

function userCanEdit(target, user = globalThis.game?.user) {
  if (!target || !user) return false;
  if (user.isGM) return true;
  const document = tokenDocument(target);
  if (document?.isOwner === true) return true;
  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return document?.testUserPermission?.(user, owner) === true;
}

function runtimeTargets(scope, context) {
  const values = scope === "source"
    ? [context.source]
    : scope === "targets"
      ? context.targets
      : [context.target];
  return values.filter(Boolean);
}

async function localTarget(uuid) {
  if (!uuid) throw new Error("Escolha o token da cena para usar um Visage local.");
  if (typeof globalThis.fromUuid !== "function") throw new Error("O resolvedor de UUID do Foundry não está disponível.");
  const document = await globalThis.fromUuid(uuid);
  if (!document) throw new Error("O token configurado para o Visage local não existe mais nesta cena.");
  return document.object ?? document;
}

export class VisageExecutor {
  static registered = false;
  static pending = new Map();

  static registerSocket() {
    if (this.registered || !globalThis.game?.socket) return;
    game.socket.on(SOCKET_EVENT, (payload, senderId) => this.#receive(payload, senderId));
    this.registered = true;
  }

  static async execute(step, context) {
    const api = visageApi();
    if (!api?.apply) throw new Error("A etapa Aplicar Visage exige o módulo Visage ativo.");
    const visageId = String(step.visageId ?? "").trim();
    if (!visageId) throw new Error("Escolha uma variação do Visage para aplicar.");
    const targets = step.mode === "local"
      ? [await localTarget(step.localTokenUuid)]
      : runtimeTargets(step.scope ?? "target", context);
    if (!targets.length) throw new Error("A etapa Aplicar Visage não encontrou tokens no escopo escolhido.");
    const unique = [...new Map(targets.map((target) => [target.document?.uuid ?? target.uuid ?? target.id, target])).values()];
    if (unique.every((target) => userCanEdit(target))) return Promise.all(unique.map((target) => api.apply(target, visageId)));
    return this.#requestGM(step, context, unique);
  }

  static async #requestGM(step, context, targets) {
    const gm = activeGM();
    if (!gm) throw new Error("Nenhum GM ativo pode aplicar o Visage no token escolhido.");
    if (!context.macro?.uuid) throw new Error("O Visage remoto exige um Macro Maker salvo.");
    const sceneId = globalThis.canvas?.scene?.id;
    if (step.mode !== "local" && !sceneId) throw new Error("A cena ativa não está disponível para aplicar o Visage.");
    const requestId = globalThis.foundry?.utils?.randomID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = {
      action: "applyVisage",
      requestId,
      requesterId: game.user.id,
      macroUuid: context.macro.uuid,
      stepId: step.id,
      sceneId,
      sourceId: tokenId(context.source),
      targetIds: targets.map(tokenId).filter(Boolean)
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("O GM não respondeu à aplicação remota do Visage."));
      }, REQUEST_TIMEOUT);
      this.pending.set(requestId, { resolve, reject, timeout, gmId: gm.id });
      game.socket.emit(SOCKET_EVENT, payload);
    });
  }

  static async #receive(payload, senderId) {
    if (payload?.action === "applyVisageResult") return this.#receiveResult(payload, senderId);
    if (payload?.action !== "applyVisage" || !game.user?.isGM || game.user.id !== activeGM()?.id) return;
    const requester = game.users?.get?.(senderId ?? payload.requesterId);
    if (!requester) return;
    let response;
    try {
      const { macro, project } = await ProjectRepository.get(payload.macroUuid);
      if (!ProjectRepository.canExecute(macro, project, requester)) {
        throw new Error("O solicitante não possui permissão para executar este Macro Maker.");
      }
      const step = this.#findStep(project.steps, payload.stepId);
      if (!step || step.type !== "applyVisage") throw new Error("A etapa Aplicar Visage solicitada não existe mais.");
      const targets = await this.#targetsForGM(step, payload, requester);
      const api = visageApi();
      if (!api?.apply) throw new Error("A etapa Aplicar Visage exige o módulo Visage ativo.");
      await Promise.all(targets.map((target) => api.apply(target, step.visageId)));
      response = { action: "applyVisageResult", requestId: payload.requestId, recipientId: requester.id, ok: true };
    } catch (error) {
      console.error("Macro Maker | falha no Visage remoto", error);
      response = { action: "applyVisageResult", requestId: payload.requestId, recipientId: requester.id, ok: false, error: error.message };
    }
    game.socket.emit(SOCKET_EVENT, response);
  }

  static #receiveResult(payload, senderId) {
    if (payload?.recipientId !== game.user?.id) return;
    const request = this.pending.get(payload.requestId);
    if (!request || senderId !== request.gmId) return;
    clearTimeout(request.timeout);
    this.pending.delete(payload.requestId);
    if (payload.ok) request.resolve({ requested: true, appliedByGM: true });
    else request.reject(new Error(payload.error || "O GM não conseguiu aplicar o Visage."));
  }

  static #findStep(steps, id) {
    for (const step of steps ?? []) {
      if (step?.id === id) return step;
      const nested = this.#findStep(step?.then, id) ?? this.#findStep(step?.else, id);
      if (nested) return nested;
    }
    return null;
  }

  static async #targetsForGM(step, payload, requester) {
    if (step.mode === "local") return [await localTarget(step.localTokenUuid)];
    const scene = game.scenes?.get?.(payload.sceneId);
    if (!scene) throw new Error("A cena da aplicação do Visage não está disponível.");
    const source = payload.sourceId ? scene.tokens?.get?.(payload.sourceId) : null;
    if (source?.actor && !source.actor.testUserPermission?.(requester, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
      throw new Error("O solicitante não controla o token de origem.");
    }
    if (step.scope === "source") {
      if (!source) throw new Error("A etapa Aplicar Visage não encontrou o token executante.");
      return [source.object ?? source];
    }
    const ids = [...new Set(Array.isArray(payload.targetIds) ? payload.targetIds : [])].slice(0, 100);
    const targets = ids.map((id) => scene.tokens?.get?.(id)).filter(Boolean).map((document) => document.object ?? document);
    if (!targets.length) throw new Error("A etapa Aplicar Visage não encontrou tokens no escopo escolhido.");
    return targets;
  }
}
