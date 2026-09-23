export class ManualHitResolver {
  static async confirm({ step, context, roll }) {
    const title = step.label || `${context.project.name} — Ataque`;
    const content = `<p>O total <strong>${Number(roll.total)}</strong> acertou o alvo?</p>`;
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (DialogV2?.wait) {
      return DialogV2.wait({
        window: { title },
        content,
        rejectClose: false,
        modal: true,
        buttons: [
          { action: "hit", label: "Acerto", icon: "fas fa-check", callback: () => true },
          { action: "miss", label: "Erro", icon: "fas fa-xmark", callback: () => false }
        ]
      });
    }
    return Dialog.wait({
      title,
      content,
      buttons: {
        hit: { label: "Acerto", icon: '<i class="fas fa-check"></i>', callback: () => true },
        miss: { label: "Erro", icon: '<i class="fas fa-xmark"></i>', callback: () => false }
      },
      close: () => null
    });
  }
}
