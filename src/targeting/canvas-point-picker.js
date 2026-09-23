export class CanvasPointPicker {
  static async pick({ source = null, range = null, blockOutOfRange = false, label = "Escolha um ponto", shape = null } = {}) {
    if (!canvas?.ready) throw new Error("O canvas precisa estar ativo para escolher um ponto.");
    const canvasElement = canvas.app?.canvas ?? canvas.app?.view;
    if (!canvasElement) throw new Error("O elemento do canvas não está disponível.");

    const originalControlledIds = new Set((canvas.tokens.controlled ?? []).map((token) => token.id));
    let restoringControl = false;

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "macro-maker-target-overlay";
      overlay.innerHTML = '<div><i class="fas fa-crosshairs"></i> ' + foundry.utils.escapeHTML(label) + ' <small>Clique para confirmar · Esc para cancelar</small></div>';
      const crosshair = document.createElement("div");
      crosshair.className = "macro-maker-crosshair";
      const rangePreview = this.#createRangePreview(source, range);
      const shapePreview = this.#createShapePreview(shape);
      document.body.append(overlay, crosshair);
      if (rangePreview) document.body.append(rangePreview);
      if (shapePreview) document.body.append(shapePreview);

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
      const onControl = () => {
        if (!restoringControl) queueMicrotask(restoreControlled);
      };
      const stopEvent = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const cleanup = () => {
        canvasElement.removeEventListener("pointermove", onMove, true);
        canvasElement.removeEventListener("pointerdown", onClick, true);
        canvasElement.removeEventListener("pointerup", stopEvent, true);
        canvasElement.removeEventListener("click", stopEvent, true);
        window.removeEventListener("keydown", onKey, true);
        Hooks.off("controlToken", controlHookId);
        overlay.remove();
        crosshair.remove();
        rangePreview?.remove();
        shapePreview?.remove();
        restoreControlled();
      };
      const finish = (result) => {
        cleanup();
        resolve(result);
      };
      const onMove = (event) => {
        crosshair.style.left = event.clientX + "px";
        crosshair.style.top = event.clientY + "px";
        this.#renderShapePreview(shapePreview, source, range, event);
      };
      const onClick = (event) => {
        if (event.button !== 0) return;
        stopEvent(event);
        const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
        if (blockOutOfRange && source && range != null && Number.isFinite(Number(range))) {
          const distance = canvas.grid.measurePath([source.center, point]).distance;
          if (distance > Number(range)) {
            ui.notifications.warn("Ponto fora do alcance (" + distance + " > " + range + ").");
            return;
          }
        }
        finish({ cancelled: false, point });
      };
      const onKey = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        finish({ cancelled: true, point: null });
      };
      const controlHookId = Hooks.on("controlToken", onControl);

      canvasElement.addEventListener("pointermove", onMove, true);
      canvasElement.addEventListener("pointerdown", onClick, true);
      canvasElement.addEventListener("pointerup", stopEvent, true);
      canvasElement.addEventListener("click", stopEvent, true);
      window.addEventListener("keydown", onKey, true);
    });
  }

  static #createRangePreview(source, range) {
    if (!source || range == null || !Number.isFinite(Number(range)) || Number(range) <= 0) return null;
    const center = canvas.clientCoordinatesFromCanvas(source.center);
    const radius = this.#screenDistance(source.center, this.#canvasDistance(range));
    const preview = document.createElement("div");
    preview.className = "macro-maker-range-preview";
    preview.style.left = (center.x - radius) + "px";
    preview.style.top = (center.y - radius) + "px";
    preview.style.width = (radius * 2) + "px";
    preview.style.height = (radius * 2) + "px";
    return preview;
  }

  static #createShapePreview(shape) {
    if (!shape || !["circle", "cone", "line"].includes(shape.mode)) return null;
    const preview = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    preview.classList.add("macro-maker-shape-preview");
    preview.setAttribute("aria-hidden", "true");
    preview.dataset.mode = shape.mode;
    preview.dataset.radius = String(shape.radius ?? 0);
    preview.dataset.angle = String(shape.angle ?? 90);
    preview.dataset.width = String(shape.width ?? 1);
    return preview;
  }

  static #renderShapePreview(preview, source, range, event) {
    if (!preview) return;
    const pointer = { x: event.clientX, y: event.clientY };
    preview.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);
    preview.setAttribute("width", String(window.innerWidth));
    preview.setAttribute("height", String(window.innerHeight));
    preview.replaceChildren();

    const mode = preview.dataset.mode;
    if (!mode) return;
    if (mode === "circle") {
      const radius = this.#screenDistance(canvas.canvasCoordinatesFromClient(pointer), this.#canvasDistance(preview.dataset.radius));
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(pointer.x));
      circle.setAttribute("cy", String(pointer.y));
      circle.setAttribute("r", String(radius));
      preview.append(circle);
      return;
    }
    if (!source) return;
    const origin = canvas.clientCoordinatesFromCanvas(source.center);
    const dx = pointer.x - origin.x;
    const dy = pointer.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const direction = Math.atan2(dy, dx);
    const rangeLength = Number.isFinite(Number(range)) && Number(range) > 0
      ? this.#screenDistance(source.center, this.#canvasDistance(range))
      : length;
    if (mode === "cone") {
      const radius = this.#screenDistance(source.center, this.#canvasDistance(preview.dataset.radius));
      const angle = Math.max(1, Math.min(360, Number(preview.dataset.angle) || 90)) * Math.PI / 180;
      const left = { x: origin.x + Math.cos(direction - angle / 2) * radius, y: origin.y + Math.sin(direction - angle / 2) * radius };
      const right = { x: origin.x + Math.cos(direction + angle / 2) * radius, y: origin.y + Math.sin(direction + angle / 2) * radius };
      const arc = angle > Math.PI ? 1 : 0;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M " + origin.x + " " + origin.y + " L " + left.x + " " + left.y + " A " + radius + " " + radius + " 0 " + arc + " 1 " + right.x + " " + right.y + " Z");
      preview.append(path);
      return;
    }
    const usedLength = Math.min(length, rangeLength);
    const end = { x: origin.x + dx / length * usedLength, y: origin.y + dy / length * usedLength };
    const halfWidth = this.#screenDistance(source.center, this.#canvasDistance(preview.dataset.width)) / 2;
    const nx = -dy / length * halfWidth;
    const ny = dx / length * halfWidth;
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", [
      (origin.x + nx) + "," + (origin.y + ny),
      (end.x + nx) + "," + (end.y + ny),
      (end.x - nx) + "," + (end.y - ny),
      (origin.x - nx) + "," + (origin.y - ny)
    ].join(" "));
    preview.append(polygon);
  }

  static #canvasDistance(value) {
    return Number(value) * canvas.grid.size / (Number(canvas.grid.distance) || 1);
  }

  static #screenDistance(origin, canvasDistance) {
    const center = canvas.clientCoordinatesFromCanvas(origin);
    const edge = canvas.clientCoordinatesFromCanvas({ x: origin.x + canvasDistance, y: origin.y });
    return Math.abs(edge.x - center.x);
  }
}
