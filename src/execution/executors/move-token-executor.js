import { MODULE_ID } from "../../constants.js";
import { ProjectRepository } from "../../services/project-repository.js";

const SOCKET_EVENT = "module." + MODULE_ID;
const REQUEST_TIMEOUT = 15_000;
const MAX_TOKENS = 100;

function activeGM() {
  return globalThis.game?.users?.activeGM
    ?? [...(globalThis.game?.users?.contents ?? [])].find((user) => user.active && user.isGM)
    ?? null;
}

function documentFor(value) {
  return value?.document ?? value ?? null;
}

function documentId(value) {
  return documentFor(value)?.id ?? value?.id ?? null;
}

function canEdit(document, user = globalThis.game?.user) {
  if (!document || !user) return false;
  if (user.isGM || document.isOwner === true) return true;
  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return document.testUserPermission?.(user, owner) === true;
}

function documentsFor(scope, context) {
  const values = scope === "source"
    ? [context.source]
    : scope === "targets"
      ? context.targets
      : [context.target];
  const documents = values.map(documentFor).filter((document) => document && typeof document.update === "function");
  return [...new Map(documents.map((document) => [document.uuid ?? document.id, document])).values()];
}

function gridSize(scene = null) {
  const size = Number(scene?.grid?.size ?? globalThis.canvas?.grid?.size);
  return Number.isFinite(size) && size > 0 ? size : 100;
}

function pointOf(value, grid) {
  const point = value?.center ?? value;
  if (Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))) {
    return { x: Number(point.x), y: Number(point.y) };
  }
  const document = documentFor(value);
  const x = Number(document?.x);
  const y = Number(document?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: x + (Math.max(0.1, Number(document.width) || 1) * grid / 2),
    y: y + (Math.max(0.1, Number(document.height) || 1) * grid / 2)
  };
}

function destinationFor(step, context) {
  const reference = step.destination ?? "location";
  if (reference === "source") return context.source;
  if (reference === "target") return context.target;
  return context.location;
}

function moveData(document, point, grid, snapToGrid) {
  let x = point.x - (Math.max(0.1, Number(document.width) || 1) * grid / 2);
  let y = point.y - (Math.max(0.1, Number(document.height) || 1) * grid / 2);
  if (snapToGrid) {
    x = Math.round(x / grid) * grid;
    y = Math.round(y / grid) * grid;
  }
  return { x, y };
}

function safePoint(value) {
  if (!Number.isFinite(Number(value?.x)) || !Number.isFinite(Number(value?.y))) return null;
  return { x: Number(value.x), y: Number(value.y) };
}

export class MoveTokenExecutor {
  static registered = false;
  static pending = new Map();

  static registerSocket() {
    if (this.registered || !globalThis.game?.socket) return;
    game.socket.on(SOCKET_EVENT, (payload, senderId) => this.#receive(payload, senderId));
    this.registered = true;
  }

  static async execute(step, context) {
    const documents = documentsFor(step.scope ?? "target", context);
    if (!documents.length) throw new Error("A etapa Mover token não encontrou tokens no escopo escolhido.");
    const destination = pointOf(destinationFor(step, context), gridSize());
    if (!destination) throw new Error("Escolha um destino válido para mover o token.");
    if (documents.every((document) => canEdit(document))) return this.#move(step, documents, destination);
    return this.#requestGM(step, context, documents, destination);
  }

  static async #move(step, documents, destination, scene = null) {
    const grid = gridSize(scene);
    const options = { animate: step.mode === "move" };
    return Promise.all(documents.map((document) => document.update(moveData(document, destination, grid, step.snapToGrid !== false), options)));
  }

  static async #requestGM(step, context, documents, destination) {
    const gm = activeGM();
    if (!gm) throw new Error("Nenhum GM ativo pode mover o token escolhido.");
    if (!context.macro?.uuid) throw new Error("O movimento remoto exige um Macro Maker salvo.");
    const sceneId = globalThis.canvas?.scene?.id;
    if (!sceneId) throw new Error("A cena ativa não está disponível para mover o token.");
    const requestId = globalThis.foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = {
      action: "moveToken",
      requestId,
      requesterId: game.user.id,
      macroUuid: context.macro.uuid,
      stepId: step.id,
      sceneId,
      sourceId: documentId(context.source),
      targetId: documentId(context.target),
      tokenIds: documents.map(documentId).filter(Boolean),
      destination: safePoint(destination)
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("O GM não respondeu ao movimento remoto do token."));
      }, REQUEST_TIMEOUT);
      this.pending.set(requestId, { resolve, reject, timeout, gmId: gm.id });
      game.socket.emit(SOCKET_EVENT, payload);
    });
  }

  static async #receive(payload, senderId) {
    if (payload?.action === "moveTokenResult") return this.#receiveResult(payload, senderId);
    if (payload?.action !== "moveToken" || !game.user?.isGM || game.user.id !== activeGM()?.id) return;
    const requester = game.users?.get?.(senderId ?? payload.requesterId);
    if (!requester) return;
    let response;
    try {
      const { macro, project } = await ProjectRepository.get(payload.macroUuid);
      if (!ProjectRepository.canExecute(macro, project, requester)) {
        throw new Error("O solicitante não possui permissão para executar este Macro Maker.");
      }
      const step = this.#findStep(project.steps, payload.stepId);
      if (!step || step.type !== "moveToken") throw new Error("A etapa Mover token solicitada não existe mais.");
      const scene = game.scenes?.get?.(payload.sceneId);
      if (!scene) throw new Error("A cena do movimento não está disponível.");
      const { documents, destination } = this.#remoteMoveData(step, payload, scene, requester);
      await this.#move(step, documents, destination, scene);
      response = { action: "moveTokenResult", requestId: payload.requestId, recipientId: requester.id, ok: true };
    } catch (error) {
      console.error("Macro Maker | falha no movimento remoto", error);
      response = { action: "moveTokenResult", requestId: payload.requestId, recipientId: requester.id, ok: false, error: error.message };
    }
    game.socket.emit(SOCKET_EVENT, response);
  }

  static #receiveResult(payload, senderId) {
    if (payload?.recipientId !== game.user?.id) return;
    const request = this.pending.get(payload.requestId);
    if (!request || senderId !== request.gmId) return;
    clearTimeout(request.timeout);
    this.pending.delete(payload.requestId);
    if (payload.ok) request.resolve({ requested: true, movedByGM: true });
    else request.reject(new Error(payload.error || "O GM não conseguiu mover o token."));
  }

  static #findStep(steps, id) {
    for (const step of steps ?? []) {
      if (step?.id === id) return step;
      const nested = this.#findStep(step?.then, id) ?? this.#findStep(step?.else, id);
      if (nested) return nested;
    }
    return null;
  }

  static #remoteMoveData(step, payload, scene, requester) {
    const source = payload.sourceId ? scene.tokens?.get?.(payload.sourceId) : null;
    if (source?.actor && !source.actor.testUserPermission?.(requester, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
      throw new Error("O solicitante não controla o token de origem.");
    }
    const ids = [...new Set(Array.isArray(payload.tokenIds) ? payload.tokenIds : [])].slice(0, MAX_TOKENS);
    const requested = ids.map((id) => scene.tokens?.get?.(id)).filter(Boolean);
    const documents = step.scope === "source" ? [source] : step.scope === "target" ? [requested[0]] : requested;
    const moveDocuments = documents.filter((document) => document && typeof document.update === "function");
    if (!moveDocuments.length) throw new Error("A etapa Mover token não encontrou tokens no escopo escolhido.");
    const destination = safePoint(payload.destination);
    if (!destination) throw new Error("O destino do movimento remoto é inválido.");
    return { documents: [...new Map(moveDocuments.map((document) => [document.uuid ?? document.id, document])).values()], destination };
  }
}
