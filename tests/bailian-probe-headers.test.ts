import assert from "node:assert/strict";
import test from "node:test";
import { detectTextCompatibility } from "@/lib/ai/text-compatibility";

const baseUrl = "https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
const originalFetch = globalThis.fetch;

test("Bailian text compatibility probe sends only Bearer auth", async () => {
  const headers: Record<string, string> = {};
  globalThis.fetch = async (url, init) => {
    const h = new Headers(init?.headers);
    h.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    assert.match(String(url), /\/chat\/completions$/);
    return Response.json({
      choices: [{ message: { role: "assistant", content: '{"status":"OK"}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  };
  try {
    const settings = await detectTextCompatibility({
      baseUrl,
      apiKey: "sk-mock-test-only",
      model: "qwen-max",
      monitorOperation: "provider_connection_probe:planning",
    });
    assert.equal(settings.textProtocol, "chat_completions");
    assert.equal(headers.authorization, "Bearer sk-mock-test-only");
    assert.equal(headers["x-api-key"], undefined);
    assert.equal(headers["x-goog-api-key"], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});