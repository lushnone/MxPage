import { z } from "zod";

const EXPRESSIONS = ["photo", "annotation", "statement", "information"] as const;

export type PlanSectionHint = { title?: string; objective?: string; copy?: string; kind?: string };

export type AlignableArtSection = {
  sectionIndex: number;
  expression: (typeof EXPRESSIONS)[number];
  prompt: string;
  textBlocks: Array<{
    text: string;
    role: string;
    x: number;
    y: number;
    width: number;
    fontSize: number;
    lineHeight: number;
    align: string;
  }>;
};

function normalizeExpression(value: unknown): (typeof EXPRESSIONS)[number] {
  if (typeof value === "string" && (EXPRESSIONS as readonly string[]).includes(value)) return value as (typeof EXPRESSIONS)[number];
  return "photo";
}

function defaultTextBlock(text: string, role = "body") {
  return { text: text.slice(0, 1600), role, x: 5, y: 5, width: 90, fontSize: 24, lineHeight: 1.2, align: "left" };
}

function buildArtSectionFromPlan(index: number, planSection?: PlanSectionHint): AlignableArtSection {
  const title = planSection?.title?.trim() || `页面 ${index + 1}`;
  const copy = (planSection?.copy || planSection?.objective || title).trim();
  const objective = planSection?.objective?.trim() || "";
  const prompt = [title, objective, copy].filter(Boolean).join("。").slice(0, 5000)
    || `${title}：商品主图/详情构图，主体清晰，自然光，背景简洁，电商详情排版。`;
  const lines = copy.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const textBlocks = (lines.length ? lines : [copy || title]).slice(0, 12).map((line, lineIndex) => defaultTextBlock(line, lineIndex === 0 ? "title" : "body"));
  return { sectionIndex: index, expression: "photo", prompt, textBlocks };
}

function normalizeArtSection(section: unknown, fallbackIndex: number, planSection?: PlanSectionHint): AlignableArtSection {
  if (!section || typeof section !== "object" || Array.isArray(section)) return buildArtSectionFromPlan(fallbackIndex, planSection);
  const row = section as Record<string, unknown>;
  const rawIndex = row.sectionIndex ?? row.index ?? fallbackIndex;
  const sectionIndex = typeof rawIndex === "number" && Number.isInteger(rawIndex) ? rawIndex
    : typeof rawIndex === "string" && /^\d+$/.test(rawIndex.trim()) ? Number(rawIndex.trim())
    : fallbackIndex;
  const expression = normalizeExpression(row.expression);
  const planFallback = buildArtSectionFromPlan(sectionIndex, planSection);
  let prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
  if (!prompt) prompt = planFallback.prompt;
  if (prompt.length > 5000) prompt = prompt.slice(0, 5000);

  let textBlocks: AlignableArtSection["textBlocks"] = [];
  if (Array.isArray(row.textBlocks)) {
    textBlocks = row.textBlocks
      .map((block, blockIndex) => {
        if (!block || typeof block !== "object" || Array.isArray(block)) return null;
        const entry = block as Record<string, unknown>;
        const text = typeof entry.text === "string" ? entry.text.trim() : "";
        if (!text) return null;
        return {
          text: text.slice(0, 1600),
          role: typeof entry.role === "string" && entry.role.trim() ? entry.role.trim() : blockIndex === 0 ? "title" : "body",
          x: typeof entry.x === "number" ? entry.x : 5,
          y: typeof entry.y === "number" ? entry.y : 5,
          width: typeof entry.width === "number" ? entry.width : 90,
          fontSize: typeof entry.fontSize === "number" ? entry.fontSize : 24,
          lineHeight: typeof entry.lineHeight === "number" ? entry.lineHeight : 1.2,
          align: typeof entry.align === "string" ? entry.align : "left",
        };
      })
      .filter((block): block is AlignableArtSection["textBlocks"][number] => Boolean(block))
      .slice(0, 12);
  }
  if (!textBlocks.length) textBlocks = planFallback.textBlocks;

  return { sectionIndex, expression, prompt, textBlocks };
}

/** 按规划槽位补齐视觉分镜，修正 sectionIndex 与缺屏（百炼常截断或漏标下标）。 */
export function alignArtDirectionSections(
  sections: unknown[],
  expected: number,
  planSections: PlanSectionHint[] = [],
): AlignableArtSection[] {
  if (expected <= 0) return [];
  const byIndex = new Map<number, AlignableArtSection>();
  for (let i = 0; i < sections.length; i++) {
    const normalized = normalizeArtSection(sections[i], i, planSections[i]);
    const index = normalized.sectionIndex;
    if (index >= 0 && index < expected) byIndex.set(index, { ...normalized, sectionIndex: index });
  }
  return Array.from({ length: expected }, (_, index) => byIndex.get(index) ?? buildArtSectionFromPlan(index, planSections[index]));
}

export function normalizeArtDirectionPayload(
  raw: unknown,
  hints: { expectedSectionCount: number; planSections?: PlanSectionHint[] },
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const value = { ...(raw as Record<string, unknown>) };
  if (typeof value.concept !== "string") value.concept = "";
  if (!Array.isArray(value.palette)) value.palette = [];
  if (typeof value.typography !== "string" || !value.typography.trim()) value.typography = "清晰易读";
  const planSections = hints.planSections ?? [];
  const expected = hints.expectedSectionCount;
  if (expected > 0) {
    const sections = Array.isArray(value.sections) ? value.sections : [];
    value.sections = alignArtDirectionSections(sections, expected, planSections);
  }
  return value;
}

export function artDirectionSchemaWithNormalization<T extends z.ZodTypeAny>(
  schema: T,
  hints: { expectedSectionCount: number; planSections?: PlanSectionHint[] },
) {
  return z.preprocess(raw => normalizeArtDirectionPayload(raw, hints), schema);
}