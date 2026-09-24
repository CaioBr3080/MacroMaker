import { canvasEventTarget, lockTokenInteraction, stopCanvasEvent } from "./canvas-interaction-lock.js";

export class CanvasTargetPicker {
  static async pick({ minTargets = 0, maxTargets = Infinity } = {}) {
    if (!canvas?.ready) throw new Error("O canvas precisa estar ativo para selecionar tokens.");
    const canvasElement = canvas.app?.canvas ?? canvas.app?.view;
    if (!canvasElement) throw new Error("O elemento do canvas não está disponível.");

    const originalIds = new Set([...game.user.targets].map((token) => token.id));
    const originalControlledIds = new Set((canvas.tokens.controlled ?? []).map((token) => token.id));
    const unlockTokenInteraction = lockTokenInteraction();
    let restoringControl = false;
    let finished = false;
    let cleanupTimer = null;

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "macro-maker-target-overlay interactive";
      overlay.innerHTML = '<div><i class="fas fa-bullseye"></i> Clique nos tokens para marcar como alvo <strong data-target-count>' + game.user.targets.size + '</strong><small>Enter confirma · Esc cancela</small><button type="button" data-confirm><i class="fas fa-check"></i> Confirmar</button><button type="button" data-cancel><i class="fas fa-xmark"></i> Cancelar</button></div>';
      document.body.append(overlay);

      const restoreControlled = () => {
        if (restoringControl) return;
        restoringControl = true;
        try {
          for (const token of canvas.tokens.placeables ?? []) {
            if (!originalControlledIds.has(token.id) && token.controlled) token.release?.({ releaseOthers: false });
          }
          for (const token of canvas.tokens.placeables ?? []) {
            if (originalControlledIds.has(token.id) && !token.controlled) token.control?.({ releaseOthers: false });
          }
        } finally {
          restoringControl = false;
        }
      };
      const updateCount = () => {
        const count = overlay.querySelector("[data-target-count]");
        if (count) count.textContent = String(game.user.targets.size);
      };
      const tokenAt = (event) => {
        const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
        return (canvas.tokens.placeables ?? []).find((token) => {
          if (token.bounds?.contains) return token.bounds.contains(point.x, point.y);
          const width = token.w ?? token.width ?? canvas.grid.size;
          const height = token.h ?? token.height ?? canvas.grid.size;
          return point.x >= token.x && point.x <= token.x + width && point.y >= token.y && point.y <= token.y + height;
        }) ?? null;
      };
      const blockCanvasEvent = (event) => {
        if (canvasEventTarget(canvasElement, event)) stopCanvasEvent(event);
      };
      const onPointerDown = (event) => {
        if (!canvasEventTarget(canvasElement, event)) return;
        stopCanvasEvent(event);
        if (event.button !== 0) return;
        const token = tokenAt(event);
        if (!token || originalControlledIds.has(token.id)) return;
        token.setTarget?.(!game.user.targets.has(token), { user: game.user, releaseOthers: false });
        updateCount();
        queueMicrotask(restoreControlled);
      };
      const onControl = (token, controlled) => {
        if (restoringControl || !controlled || originalControlledIds.has(token?.id)) return;
        token.setTarget?.(true, { user: game.user, releaseOthers: false });
        updateCount();
        queueMicrotask(restoreControlled);
      };
      const restoreTargets = () => {
        for (const token of canvas.tokens.placeables ?? []) {
          token.setTarget?.(originalIds.has(token.id), { user: game.user, releaseOthers: false });
        }
      };
      const cleanup = () => {
        if (cleanupTimer) window.clearTimeout(cleanupTimer);
        Hooks.off("targetToken", targetHookId);
        Hooks.off("controlToken", controlHookId);
        window.removeEventListener("pointerdown", onPointerDown, true);
        for (const type of ["pointerup", "pointercancel", "mousedown", "mouseup", "click", "dblclick", "contextmenu"]) {
          window.removeEventListener(type, blockCanvasEvent, true);
        }
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
        unlockTokenInteraction();
        restoreControlled();
      };
      const finish = (cancelled, deferCleanup = false) => {
        if (finished) return;
        const targets = [...game.user.targets];
        if (!cancelled && (targets.length < minTargets || targets.length > maxTargets)) {
          const expected = Number.isFinite(maxTargets) ? minTargets + "–" + maxTargets : "pelo menos " + minTargets;
          ui.notifications.warn("Selecione " + expected + " alvo(s).");
          return;
        }
        finished = true;
        if (cancelled) restoreTargets();
        if (deferCleanup) cleanupTimer = window.setTimeout(cleanup, 0);
        else cleanup();
        resolve({ cancelled, targets: cancelled ? [] : targets });
      };
      const onKey = (event) => {
        if (!["Escape", "Enter"].includes(event.key)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Escape") finish(true);
        if (event.key === "Enter") finish(false);
      };
      const targetHookId = Hooks.on("targetToken", updateCount);
      const controlHookId = Hooks.on("controlToken", onControl);
      overlay.querySelector("[data-confirm]").addEventListener("click", () => finish(false));
      overlay.querySelector("[data-cancel]").addEventListener("click", () => finish(true));
      window.addEventListener("pointerdown", onPointerDown, true);
      for (const type of ["pointerup", "pointercancel", "mousedown", "mouseup", "click", "dblclick", "contextmenu"]) {
        window.addEventListener(type, blockCanvasEvent, true);
      }
      window.addEventListener("keydown", onKey, true);
    });
  }
}