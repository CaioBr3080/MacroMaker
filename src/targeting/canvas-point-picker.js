export class CanvasPointPicker {
  static async pick({ source = null, range = null, blockOutOfRange = false, label = "Escolha um ponto" } = {}) {
    if (!canvas?.ready) throw new Error("O canvas precisa estar ativo para escolher um ponto.");
    const canvasElement = canvas.app?.canvas ?? canvas.app?.view;
    if (!canvasElement) throw new Error("O elemento do canvas não está disponível.");

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "macro-maker-target-overlay";
      overlay.innerHTML = `<div><i class="fas fa-crosshairs"></i> ${foundry.utils.escapeHTML(label)} <small>Clique para confirmar · Esc para cancelar</small></div>`;
      const crosshair = document.createElement("div");
      crosshair.className = "macro-maker-crosshair";
      const rangePreview = this.#createRangePreview(source, range);
      document.body.append(overlay, crosshair);
      if (rangePreview) document.body.append(rangePreview);

      const cleanup = () => {
        canvasElement.removeEventListener("pointermove", onMove, true);
        canvasElement.removeEventListener("pointerdown", onClick, true);
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
        crosshair.remove();
        rangePreview?.remove();
      };
      const finish = (result) => {
        cleanup();
        resolve(result);
      };
      const onMove = (event) => {
        crosshair.style.left = `${event.clientX}px`;
        crosshair.style.top = `${event.clientY}px`;
      };
      const onClick = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
        if (blockOutOfRange && source && range != null && Number.isFinite(Number(range))) {
          const distance = canvas.grid.measurePath([source.center, point]).distance;
          if (distance > Number(range)) {
            ui.notifications.warn(`Ponto fora do alcance (${distance} > ${range}).`);
            return;
          }
        }
        finish({ cancelled: false, point });
      };
      const onKey = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        finish({ cancelled: true, point: null });
      };

      canvasElement.addEventListener("pointermove", onMove, true);
      canvasElement.addEventListener("pointerdown", onClick, true);
      window.addEventListener("keydown", onKey, true);
    });
  }

  static #createRangePreview(source, range) {
    if (!source || range == null || !Number.isFinite(Number(range)) || Number(range) <= 0) return null;
    const center = canvas.clientCoordinatesFromCanvas(source.center);
    const sceneDistance = Number(canvas.grid.distance) || 1;
    const radiusInCanvasPixels = Number(range) * canvas.grid.size / sceneDistance;
    const edge = canvas.clientCoordinatesFromCanvas({ x: source.center.x + radiusInCanvasPixels, y: source.center.y });
    const radius = Math.abs(edge.x - center.x);
    const preview = document.createElement("div");
    preview.className = "macro-maker-range-preview";
    preview.style.left = `${center.x - radius}px`;
    preview.style.top = `${center.y - radius}px`;
    preview.style.width = `${radius * 2}px`;
    preview.style.height = `${radius * 2}px`;
    return preview;
  }
}
