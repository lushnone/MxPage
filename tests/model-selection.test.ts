import assert from "node:assert/strict";
import { test } from "node:test";
import { selectModel } from "../lib/ai/model-selection";

const qwenImage = {
  modelId: "qwen-image-3.0-pro",
  capabilities: { image_gen: true, image_edit: false },
  isDefaultDetailImage: true,
  isDefaultHeroImage: true,
} as const;

test("image edit falls back to detail/hero qwen-image when no edit default", () => {
  assert.equal(selectModel([qwenImage as never], "edit"), "qwen-image-3.0-pro");
});