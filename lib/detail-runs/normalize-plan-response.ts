import { z } from "zod";

export type AlignablePlanSection = {
  kind: "HERO" | "DETAIL";
  title: string;
  objective: string;
  buyerQuestion: string;
  copy: string;
  evidence: string[];
};

/** 修正百炼等模型常犯的规划 JSON 形状错误（缺根字段、sectionIndex、evidence 字符串）。 */
export function alignPlanSectionKinds(
  sections: AlignablePlanSection[],
  heroCount: number,
  detailCount: number,
): AlignablePlanSection[] {
  const expected = heroCount + detailCount;
  if (expected <= 0 || sections.length === 0) return sections;
  const padded = sections.slice(0, expected);
  while (padded.length < expected) {
    const index = padded.length;
    const kind: "HERO" | "DETAIL" = index < heroCount ? "HERO" : "DETAIL";
    const slot = kind === "HERO" ? index + 1 : index - heroCount + 1;
    padded.push({
      kind,
      title: kind === "HERO" ? `主图 ${slot}` : `详情 ${slot}`,
      objective: kind === "HERO" ? "主图展示" : "详情说明",
      buyerQuestion: "",
      copy: "",
      evidence: [],
    });
  }
  return padded.map((section, index) => ({ ...section, kind: index < heroCount ? "HERO" : "DETAIL" }));
}

export function normalizePlanModelPayload(
  raw: unknown,
  hints: { productName?: string; category?: string; heroCount?: number; detailCount?: number },
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const value = { ...(raw as Record<string, unknown>) };
  const name = typeof value.productName === "string" ? value.productName.trim() : "";
  value.productName = name || hints.productName?.trim() || "商品";
  const category = typeof value.category === "string" ? value.category.trim() : "";
  value.category = category || hints.category?.trim() || "general";
  if (!Array.isArray(value.facts)) value.facts = [];
  if (!Array.isArray(value.requirements)) value.requirements = [];
  if (!Array.isArray(value.contentCoverage)) value.contentCoverage = [];
  if (!Array.isArray(value.missingFields)) {
    value.missingFields = [];
  } else {
    value.missingFields = value.missingFields
      .map(entry => normalizeMissingField(entry))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }
  if (Array.isArray(value.sections)) {
    value.sections = value.sections.map((section, index) => normalizePlanSection(section, index));
    const heroCount = hints.heroCount ?? 0;
    const detailCount = hints.detailCount ?? 0;
    if (heroCount + detailCount > 0) {
      value.sections = alignPlanSectionKinds(value.sections as AlignablePlanSection[], heroCount, detailCount);
    }
  }
  return value;
}

function normalizeMissingField(entry: unknown) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const row = entry as Record<string, unknown>;
  const field = typeof row.field === "string" ? row.field.trim() : typeof row.name === "string" ? row.name.trim() : "";
  if (!field) return null;
  const question = typeof row.question === "string" && row.question.trim() ? row.question.trim() : field;
  return {
    field,
    question,
    blocking: typeof row.blocking === "boolean" ? row.blocking : false,
    options: Array.isArray(row.options) ? row.options.filter((opt): opt is string => typeof opt === "string" && opt.trim().length > 0) : [],
  };
}

function normalizePlanSection(section: unknown, index: number) {
  if (!section || typeof section !== "object" || Array.isArray(section)) return section;
  const row = { ...(section as Record<string, unknown>) };
  const copy = typeof row.copy === "string" ? row.copy.trim() : "";
  const kind = row.kind === "HERO" || row.kind === "DETAIL" ? row.kind : "DETAIL";
  const titleFromCopy = copy.split(/[\n:：]/)[0]?.trim().slice(0, 100);
  const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : titleFromCopy || `页面 ${index + 1}`;
  const objective = typeof row.objective === "string" && row.objective.trim()
    ? row.objective.trim()
    : (copy || title).slice(0, 500);
  const buyerQuestion = typeof row.buyerQuestion === "string" ? row.buyerQuestion : "";
  if (typeof row.evidence === "string" && row.evidence.trim()) {
    row.evidence = [row.evidence.trim()];
  } else if (!Array.isArray(row.evidence)) {
    row.evidence = [];
  }
  delete row.sectionIndex;
  return { kind, title, objective, buyerQuestion, copy: copy || objective, evidence: row.evidence };
}

export function planSchemaWithNormalization<T extends z.ZodTypeAny>(
  schema: T,
  hints: { productName: string; category?: string; heroCount?: number; detailCount?: number },
) {
  return z.preprocess(raw => normalizePlanModelPayload(raw, hints), schema);
}