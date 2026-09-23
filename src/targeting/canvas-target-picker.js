export class CanvasTargetPicker {
  static async pick({ minTargets = 0, maxTargets = Infinity } = {}) {
    if (!canvas?.ready) throw new Error("O canvas precisa estar ativo para selecionar tokens.");
    const originalIds = new Set([...game.user.targets].map((token) => token.id));

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "macro-maker-target-overlay interactive";
      overlay.innerHTML = `
        <div>
          <i class="fas fa-bullseye"></i>
          Marque tokens com T <strong data-target-count>${game.user.targets.size}</strong>
          <button type="button" data-confirm><i class="fas fa-check"></i> Confirmar</button>
          <button type="button" data-cancel><i class="fas fa-xmark"></i> Cancelar</button>
        </div>`;
      document.body.append(overlay);

      const cleanup = () => {
        Hooks.off("targetToken", hookId);
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
      };
      const restore = () => {
        for (const token of canvas.tokens.placeables) {
          token.setTarget(originalIds.has(token.id), { user: game.user, releaseOthers: false });
        }
      };
      const finish = (cancelled) => {
        const targets = [...game.user.targets];
        if (!cancelled && (targets.length < minTargets || targets.length > maxTargets)) {
          const range = Number.isFinite(maxTargets) ? `${minTargets}–${maxTargets}` : `pelo menos ${minTargets}`;
          ui.notifications.warn(`Selecione ${range} alvo(s).`);
          return;
        }
        if (cancelled) restore();
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
      const hookId = Hooks.on("targetToken", updateCount);
      overlay.querySelector("[data-confirm]").addEventListener("click", () => finish(false));
      overlay.querySelector("[data-cancel]").addEventListener("click", () => finish(true));
      window.addEventListener("keydown", onKey, true);
    });
  }
}
