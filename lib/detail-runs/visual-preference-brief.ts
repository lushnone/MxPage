import { z } from "zod";
import { detectTextDensity, type TextDensity } from "./visual-execution-policy";

export const visualPreferenceBriefSchema = z.object({
  globalConstraints: z.array(z.string().min(1).max(300)).max(12).default([]),
  referenceImageUse: z.string().max(500).default(""),
  textStyle: z.enum(["minimal", "standard"]).default("standard"),
  sectionHints: z.array(z.object({
    sectionIndex: z.number().int().nonnegative(),
    constraints: z.array(z.string().min(1).max(300)).max(8).default([]),
  })).max(30).default([]),
  forbiddenVisibleText: z.array(z.string().min(1).max(80)).max(20).default([]),
});

export type VisualPreferenceBrief = z.infer<typeof visualPreferenceBriefSchema>;

export const visualPreferenceBriefSystem = `你是电商详情页视觉执行契约模型。只返回 JSON。根据用户创意偏好、规划 requirements、商品名称与描述，整理成生图阶段必须遵守的视觉契约（不是广告文案）。
规则：
1. globalConstraints：全任务有效的画面/场景/风格/禁止项，用简短中文陈述句，每条不超过 80 字。
2. referenceImageUse：一句话说明上传参考图仅可用于什么（材质、工艺、形态、色泽），以及必须避免什么（第三方 logo、品牌字、参考图原场景墙面地面等）。
3. textStyle：用户明确要少字、Channel 高级感、极简时填 minimal，否则 standard。
4. sectionHints：可选，为每一屏 sectionIndex 补充仅与该屏相关的额外约束（如工艺特写强调手工、卧室场景强调换墙换地）；没有可为空数组。
5. forbiddenVisibleText：禁止出现在成图上的品牌名、logo 文案、英文品牌等，逐条列出（如 AliceTod）。
不要编造用户未要求的卖点；不要输出制作说明字段。`;

export type VisualPreferenceBriefInput = {
  userInstruction: string;
  requirements: string[];
  productName: string;
  description: string;
  recognitionName?: string;
  identityAuthority?: string;
  sectionCount: number;
};

export function fallbackVisualPreferenceBrief(input: VisualPreferenceBriefInput): VisualPreferenceBrief {
  const globalConstraints = [
    ...input.requirements.filter(r => /logo|品牌|背景|墙面|地面|高级|欧美|channel|模特|字/i.test(r)),
    ...input.userInstruction.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 6),
  ].filter((line, index, arr) => arr.indexOf(line) === index).slice(0, 10);
  const forbidden = [...input.userInstruction.matchAll(/alice\s*tod|alicetod/gi)].map(m => m[0]);
  if (/logo|品牌/i.test(input.userInstruction)) forbidden.push("logo", "品牌标识");
  const textStyle = detectTextDensity(input.userInstruction);
  return visualPreferenceBriefSchema.parse({
    globalConstraints: globalConstraints.length ? globalConstraints : ["遵守用户创意偏好中的视觉与禁止项"],
    referenceImageUse: /logo|品牌|alicetod|换.*背景|墙面|地面/i.test(input.userInstruction)
      ? "参考图仅用于材质、工艺与本白色泽；重新设计墙面与地面场景，不得复刻参考图第三方品牌、logo 或原场景。"
      : "参考图用于商品形态与材质事实；场景与背景可独立设计。",
    textStyle,
    sectionHints: [],
    forbiddenVisibleText: [...new Set(forbidden.map(s => s.replace(/\s/gu, "")))],
  });
}

const CONTRACT_HEADER = "User visual contract (must not violate):";

export function formatBriefForImagePrompt(
  brief: VisualPreferenceBrief,
  sectionIndex: number,
  kind: "HERO" | "DETAIL",
): string {
  const lines = [`${CONTRACT_HEADER}`];
  for (const item of brief.globalConstraints) lines.push(`- ${item}`);
  const hints = brief.sectionHints.find(h => h.sectionIndex === sectionIndex);
  if (hints?.constraints.length) for (const item of hints.constraints) lines.push(`- ${item}`);
  if (brief.referenceImageUse.trim()) lines.push(`Reference images: ${brief.referenceImageUse.trim()}`);
  if (brief.forbiddenVisibleText.length) {
    lines.push(`Forbidden in image (do not render): ${brief.forbiddenVisibleText.join(", ")}`);
  }
  if (brief.textStyle === "minimal") {
    lines.push(`Typography: ${kind} — render at most one headline plus ${kind === "HERO" ? "two" : "four"} short support lines from Exact copy below; omit extra lines intentionally.`);
  }
  return lines.join("\n");
}

export function briefContractHeader() {
  return CONTRACT_HEADER;
}

export function resolveTextStyle(brief: VisualPreferenceBrief | undefined, userInstruction: string): TextDensity {
  return detectTextDensity(userInstruction, brief);
}