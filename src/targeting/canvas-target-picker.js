export class CanvasTargetPicker {
  static async pick({ minTargets = 0, maxTargets = Infinity } = {}) {
    if (!canvas?.ready) throw new Error("O canvas precisa estar ativo para selecionar tokens.");
    const originalIds = new Set([...game.user.targets].map((token) => token.id));
    const originalControlledIds = new Set((canvas.tokens.controlled ?? []).map((token) => token.id));
    let restoringControl = false;

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "macro-maker-target-overlay interactive";
      overlay.innerHTML = `
        <div>
          <i class="fas fa-bullseye"></i>
          Clique nos tokens para marcar como alvo
          <strong data-target-count>${game.user.targets.size}</strong>
          <small>Shift/T também funciona</small>
          <button type="button" data-confirm><i class="fas fa-check"></i> Confirmar</button>
          <button type="button" data-cancel><i class="fas fa-xmark"></i> Cancelar</button>
        </div>`;
      document.body.append(overlay);

      const restoreControlled = () => {
        if (restoringControl) return;
        restoringControl = true;
        try {
          for (const token of canvas.tokens.placeables ?? []) {
            if (!originalControlledIds.has(token.id) && token.controlled) {
              token.release?.({ releaseOthers: false });
            }
          }
          for (const token of canvas.tokens.placeables ?? []) {
            if (originalControlledIds.has(token.id) && !token.controlled) {
              token.control?.({ releaseOthers: false });
            }
          }
        } finally {
          restoringControl = false;
        }
      };
      const onControl = (token, controlled) => {
        if (restoringControl) return;
        if (!controlled) {
          if (originalControlledIds.has(token?.id)) queueMicrotask(restoreControlled);
          return;
        }
        if (originalControlledIds.has(token?.id)) return;
        // Foundry normally controls a token on a plain click. During this picker,
        // convert that click to a target and immediately restore the attacker.
        token.setTarget?.(true, { user: game.user, releaseOthers: false });
        updateCount();
        queueMicrotask(restoreControlled);
      };
      const controlHookId = Hooks.on("controlToken", onControl);
      const cleanup = () => {
        Hooks.off("targetToken", targetHookId);
        Hooks.off("controlToken", controlHookId);
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
        restoreControlled();
      };
      const restoreTargets = () => {
        for (const token of canvas.tokens.placeables ?? []) {
          token.setTarget?.(originalIds.has(token.id), { user: game.user, releaseOthers: false });
        }
      };
      const finish = (cancelled) => {
        const targets = [...game.user.targets];
        if (!cancelled && (targets.length < minTargets || targets.length > maxTargets)) {
          const range = Number.isFinite(maxTargets) ? `${minTargets}–${maxTargets}` : `pelo menos ${minTargets}`;
          ui.notifications.warn(`Selecione ${range} alvo(s).`);
          return;
        }
        if (cancelled) restoreTargets();
        cleanup();
        resolve({ cancelled, targets: cancelled ? [] : targets });
      };
      const updateCount = () => {
        const count = overlay.querySelector("[data-target-count]");
        if (count) count.textContent = String(game.user.targets.size);
      };
      const onKey = (event) => {
        if (!["Escape", "Enter"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") finish(true);
        if (event.key === "Enter") finish(false);
      };
      const targetHookId = Hooks.on("targetToken", updateCount);
      overlay.querySelector("[data-confirm]").addEventListener("click", () => finish(false));
      overlay.querySelector("[data-cancel]").addEventListener("click", () => finish(true));
      window.addEventListener("keydown", onKey, true);
    });
  }
}
