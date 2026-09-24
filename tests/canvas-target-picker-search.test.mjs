import test from "node:test";
import assert from "node:assert/strict";
import { searchTokens } from "../src/targeting/canvas-target-picker.js";

test("busca tokens por nome ignorando maiúsculas e acentos", () => {
  const tokens = [{ name: "Aldine" }, { name: "São Davo" }, { name: "Lobisomem" }];
  assert.deepEqual(searchTokens(tokens, "sao").map((token) => token.name), ["São Davo"]);
  assert.deepEqual(searchTokens(tokens, "ALD").map((token) => token.name), ["Aldine"]);
  assert.equal(searchTokens(tokens, "").length, 3);
});