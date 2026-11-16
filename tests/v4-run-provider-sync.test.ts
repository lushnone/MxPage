import assert from "node:assert/strict";
import { test } from "node:test";
import { modelRoleFields, selectModel } from "@/lib/ai/model-selection";

test("planning default may be text-only even when workflow attaches images", () => {
  const models = [
    { modelId: "qwen-max", capabilities: { text: true, vision: false, structured_output: true }, isDefaultPlanning: true, isAvailable: true },
    { modelId: "qwen-plus", capabilities: { text: true, vision: false, structured_output: true }, isDefaultAnalysis: true, isAvailable: true },
  ];
  assert.equal(selectModel(models, "planning", undefined, true), "qwen-max");
  assert.throws(() => selectModel(models, "analysis"), /vision/);
});

test("V4 sync skips image edit default when none is assigned", () => {
  const models = [
    { modelId: "qwen-max", capabilities: { text: true }, isDefaultPlanning: true, isAvailable: true },
    { modelId: "qwen-image-3.0-pro", capabilities: { image_gen: true, real_image_gen: true }, isDefaultHeroImage: true, isDefaultDetailImage: true, isAvailable: true },
  ];
  assert.ok(!models.some(model => model[modelRoleFields.edit as keyof typeof model]));
  assert.doesNotThrow(() => selectModel(models, "planning"));
  assert.throws(() => selectModel(models, "edit"), /图像编辑/);
});