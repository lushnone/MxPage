import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    process.env[key] ??= value;
  }
}

loadDotEnv();

const apiKey = process.env.MXPAGE_PROBE_API_KEY?.trim() || process.argv[2]?.trim() || "";
const baseUrl = process.env.MXPAGE_PROBE_BASE_URL?.trim() || process.argv[3]?.trim() || "";

const { prisma } = await import("../lib/db/prisma.ts");
const route = await import("../app/api/providers/agent-compatibility/route.ts");

const providers = await prisma.providerConfig.findMany({
  include: { models: true },
  orderBy: { updatedAt: "desc" },
});

console.log("=== 数据库 Provider 快照 ===");
if (!providers.length) {
  console.log("（空）当前 SQLite 里没有已保存的 Provider。若页面仍显示配置，多半是浏览器未刷新或 Key 只在 localStorage。");
} else {
  for (const p of providers) {
    const planning = p.models.find((m) => m.isDefaultPlanning);
    const analysis = p.models.find((m) => m.isDefaultAnalysis);
    console.log(`- ${p.name} | active=${p.isActive} | ${p.baseUrl}`);
    console.log(`  规划: ${planning?.modelId ?? "未设"} | 识图: ${analysis?.modelId ?? "未设"}`);
  }
}

if (!apiKey) {
  console.log("\n未提供 API Key，无法向上游探测。用法：");
  console.log("  MXPAGE_PROBE_API_KEY=你的key [MXPAGE_PROBE_BASE_URL=服务地址] node scripts/diagnose-provider-probe.mjs");
  console.log("或在后面写: node scripts/diagnose-provider-probe.mjs <apiKey> [baseUrl]");
  await prisma.$disconnect();
  process.exit(0);
}

const headers = { "x-mxpage-api-key": apiKey };
if (baseUrl) headers["x-mxpage-base-url"] = baseUrl;

console.log("\n=== 调用 agent-compatibility（与「探测并保存」最后一步相同）===");
const response = await route.POST(
  new NextRequest("http://127.0.0.1/api/providers/agent-compatibility", { method: "POST", headers }),
);
const payload = await response.json();
console.log("HTTP", response.status);
console.log(JSON.stringify(payload, null, 2));

await prisma.$disconnect();
process.exit(payload.success ? 0 : 1);