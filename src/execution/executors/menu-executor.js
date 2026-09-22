export class MenuExecutor {
  static async execute(step, context) {
    const options = (step.options ?? []).map((option) => ({
      value: option.value,
      label: option.label
    }));
    if (!options.length) throw new Error("A etapa de menu não possui opções.");

    const content = `
      <form class="macro-maker-menu">
        <div class="form-group">
          <label>${foundry.utils.escapeHTML(step.label ?? "Escolha uma opção")}</label>
          <select name="choice">
            ${options.map((option) => `<option value="${foundry.utils.escapeHTML(String(option.value))}">${foundry.utils.escapeHTML(option.label)}</option>`).join("")}
          </select>
        </div>
      </form>`;

    const value = await Dialog.wait({
      title: step.title ?? context.project.name,
      content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: "Confirmar",
          callback: (html) => html.find('[name="choice"]').val()
        }
      },
      close: () => null
    });

    if (value == null && step.cancelStops !== false) throw new Error("Execução cancelada.");
    context.variables[step.variable ?? "choice"] = value;
  }
}
