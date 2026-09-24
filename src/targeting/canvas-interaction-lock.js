function hasProperty(object, key) {
  return object && key in object;
}

export function canvasEventTarget(canvasElement, event) {
  if (!canvasElement || !event) return false;
  if (event.target === canvasElement || canvasElement.contains?.(event.target)) return true;
  return event.composedPath?.().includes(canvasElement) === true;
}

export function stopCanvasEvent(event) {
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  event.stopPropagation?.();
}

export function lockTokenInteraction() {
  const records = [];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const record = {
      token,
      eventMode: hasProperty(token, "eventMode") ? token.eventMode : undefined,
      interactive: hasProperty(token, "interactive") ? token.interactive : undefined,
      interactiveChildren: hasProperty(token, "interactiveChildren") ? token.interactiveChildren : undefined
    };
    records.push(record);
    try {
      if (record.eventMode !== undefined) token.eventMode = "none";
      if (record.interactive !== undefined) token.interactive = false;
      if (record.interactiveChildren !== undefined) token.interactiveChildren = false;
    } catch (error) {
      console.debug("Macro Maker | não foi possível bloquear a interação do token", error);
    }
  }
  return () => {
    for (const record of records) {
      try {
        if (record.eventMode !== undefined) record.token.eventMode = record.eventMode;
        if (record.interactive !== undefined) record.token.interactive = record.interactive;
        if (record.interactiveChildren !== undefined) record.token.interactiveChildren = record.interactiveChildren;
      } catch (error) {
        console.debug("Macro Maker | não foi possível restaurar a interação do token", error);
      }
    }
  };
}