import test from "node:test";
import assert from "node:assert/strict";
import { dashscopeStructuredRequestExtras } from "@/lib/ai/dashscope-thinking";
import { buildTextRequest, chatAssistantText, parseTextResponse } from "@/lib/ai/text-transport";
import { z } from "zod";

test("structured workflow on Bailian disables thinking for all models", () => {
  const base = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
  for (const model of ["qwen3.8-omni-flash", "qwen3.7-plus", "qwen3.8-flash", "deepseek-v4.1-flash"]) {
    assert.equal(dashscopeStructuredRequestExtras(base, model, true).enable_thinking, false, model);
  }
  assert.deepEqual(dashscopeStructuredRequestExtras(base, "qwen3.8-flash", false), {});
});

test("buildTextRequest attaches enable_thinking false for structured Bailian calls", () => {
  const request = buildTextRequest({
    baseUrl: "https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    apiKey: "sk-test",
    model: "qwen3.8-omni-flash",
    system: "Return JSON",
    input: "{}",
    timeoutMs: 1000,
    schema: z.object({ status: z.literal("OK") }),
    textProtocol: "chat_completions",
    structuredOutputMode: "json_object",
  });
  assert.equal((request as { enable_thinking?: boolean }).enable_thinking, false);
});

test("parseTextResponse reads array message content", () => {
  const body = JSON.stringify({
    choices: [{ message: { role: "assistant", content: [{ type: "text", text: '{"status":"OK"}' }] }, finish_reason: "stop" }],
  });
  const { text } = parseTextResponse(body, "chat_completions");
  assert.equal(text, '{"status":"OK"}');
});

test("chatAssistantText joins text parts", () => {
  assert.equal(chatAssistantText([{ type: "text", text: "a" }, { type: "text", text: "b" }]), "ab");
});