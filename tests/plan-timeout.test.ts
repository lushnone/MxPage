import assert from "node:assert/strict";
import { test } from "node:test";
import { imageGenerationTimeoutMs } from "@/lib/ai/image-protocol";
import { planMaxOutputTokens, planRequestTimeoutMs } from "@/lib/detail-runs/service-v4";

test("commerce plan timeout scales with screens and reference images", () => {
  const fourSixThree = planRequestTimeoutMs({ mode: "create", heroCount: 4, detailCount: 6 }, 3);
  assert.equal(fourSixThree, 360_000, "4+6 screens with 3 images gets 6 minutes");
  assert.ok(planRequestTimeoutMs({ mode: "create", heroCount: 0, detailCount: 10 }, 5) <= 420_000);
});

test("Bailian plan caps max output tokens at 8192", () => {
  assert.equal(planMaxOutputTokens("https://foo.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"), 8192);
  assert.equal(planMaxOutputTokens("https://api.openai.com/v1"), 16_384);
});

test("OpenAI-compatible MaaS image generation waits up to 10 minutes", () => {
  assert.equal(imageGenerationTimeoutMs("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"), 600_000);
  assert.equal(imageGenerationTimeoutMs("https://api.openai.com/v1"), 180_000);
});