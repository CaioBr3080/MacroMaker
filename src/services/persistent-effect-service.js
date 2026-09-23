import { MODULE_ID } from "../constants.js";

function effectName(effect) {
  return effect?.data?.name ?? effect?.name ?? effect?._source?.name ?? "";
}

export class PersistentEffectService {
  list({ sceneId = globalThis.canvas?.scene?.id } = {}) {
    const manager = globalThis.Sequencer?.EffectManager;
    if (!manager?.getEffects) return [];
    const effects = manager.getEffects({ name: `${MODULE_ID}.*`, ...(sceneId ? { sceneId } : {}) }) ?? [];
    return [...effects].map((effect) => {
      const name = effectName(effect);
      const [, projectId = "", stepId = "", logicalName = ""] = name.split(".");
      return {
        id: effect.id ?? effect._id ?? null,
        name,
        projectId,
        stepId,
        label: logicalName || name,
        sceneId: effect.data?.sceneId ?? effect.sceneId ?? sceneId,
        source: effect.data?.source ?? effect.source,
        target: effect.data?.target ?? effect.target,
        orphan: !projectId || !stepId
      };
    });
  }

  async end({ id = null, name = null, sceneId = null } = {}) {
    const manager = globalThis.Sequencer?.EffectManager;
    if (!manager?.endEffects) throw new Error("O módulo Sequencer precisa estar ativo.");
    if (!id && !name) throw new Error("Informe o efeito persistente que será encerrado.");
    const filters = id ? { effects: id } : { name };
    if (sceneId) filters.sceneId = sceneId;
    await manager.endEffects(filters);
  }

  async cleanupDocument(document) {
    const manager = globalThis.Sequencer?.EffectManager;
    if (!manager?.endEffects || !document) return;
    const sceneId = document.parent?.id ?? document.id;
    if (document.documentName === "Scene") {
      await manager.endEffects({ name: `${MODULE_ID}.*`, sceneId });
      return;
    }
    await manager.endEffects({ name: `${MODULE_ID}.*`, object: document.object ?? document, ...(sceneId ? { sceneId } : {}) });
  }
}
