import test from "node:test";
import assert from "node:assert/strict";
import { MenuExecutor } from "../src/execution/executors/menu-executor.js";
import { VariableExecutor } from "../src/execution/executors/variable-executor.js";

test("menu visual escapa HTML e preserva valores tipados", async (t) => {
  let rendered = "";
  globalThis.Dialog = {
    wait: async (config) => {
      rendered = config.content;
      return config.buttons.confirm.callback({ querySelectorAll: () => [{ value: "1" }] });
    }
  };
  t.after(() => delete globalThis.Dialog);
  const context = { project: { name: "Teste" }, variables: { poison: "<script>" } };

  const value = await MenuExecutor.execute({
    variable: "choice",
    title: "Veneno",
    description: "Escolha {{variables.poison}}",
    options: [
      { label: "Fraco", value: { damage: 1 } },
      { label: "<img src=x onerror=alert(1)>", value: { damage: 3 } }
    ]
  }, context);

  assert.deepEqual(value, { damage: 3 });
  assert.deepEqual(context.variables.choice, { damage: 3 });
  assert.equal(rendered.includes("<script>"), false);
  assert.equal(rendered.includes("<img src=x onerror"), false);
  assert.match(rendered, /&lt;script&gt;/);
});

test("cancelamento pode usar padrão e variáveis não vazam entre contextos", async (t) => {
  globalThis.Dialog = { wait: async () => null };
  t.after(() => delete globalThis.Dialog);
  const first = { project: { name: "Teste" }, variables: {} };
  const second = { project: { name: "Teste" }, variables: {} };
  await MenuExecutor.execute({
    variable: "poison",
    cancelBehavior: "default",
    defaultValue: "green",
    options: [{ label: "Verde", value: "green" }]
  }, first);
  await VariableExecutor.execute({ variable: "uses", operation: "add", valueType: "number", value: 1 }, first);

  assert.equal(first.variables.poison, "green");
  assert.equal(first.variables.uses, 1);
  assert.deepEqual(second.variables, {});
});
