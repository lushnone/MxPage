import assert from "node:assert/strict";
import { test } from "node:test";
import { alignPlanSectionKinds, normalizePlanModelPayload } from "@/lib/detail-runs/normalize-plan-response";
import { z } from "zod";

const sectionSchema = z.object({
  kind: z.enum(["HERO", "DETAIL"]),
  title: z.string().min(1),
  objective: z.string().min(1),
  buyerQuestion: z.string(),
  copy: z.string(),
  evidence: z.array(z.string()),
});

test("coerces sectionIndex-style PLAN payload toward schema", () => {
  const raw = {
    sections: [
      { sectionIndex: 0, kind: "HERO", copy: "AliceTod 白色蓝边床品套件", evidence: "asset-1" },
      { sectionIndex: 1, kind: "DETAIL", copy: "需求与痛点", evidence: "user_description" },
    ],
    missingFields: [{ field: "size", question: 123, blocking: "yes", options: "bad" }],
  };
  const normalized = normalizePlanModelPayload(raw, { productName: "AliceTod 床品" }) as Record<string, unknown>;
  assert.equal(normalized.productName, "AliceTod 床品");
  assert.equal(normalized.category, "general");
  assert.deepEqual(normalized.facts, []);
  assert.equal((normalized.missingFields as unknown[]).length, 1);
  const sections = z.array(sectionSchema).parse(normalized.sections);
  assert.equal(sections[0]!.evidence[0], "asset-1");
  assert.equal(sections[0]!.objective, "AliceTod 白色蓝边床品套件");
});

test("alignPlanSectionKinds re-labels slots for 4 HERO + 6 DETAIL", () => {
  const sections = Array.from({ length: 10 }, (_, index) => ({
    kind: "DETAIL" as const,
    title: `S${index}`,
    objective: "展示",
    buyerQuestion: "",
    copy: "",
    evidence: [] as string[],
  }));
  const aligned = alignPlanSectionKinds(sections, 4, 6);
  assert.equal(aligned.filter(s => s.kind === "HERO").length, 4);
  assert.equal(aligned.filter(s => s.kind === "DETAIL").length, 6);
  assert.equal(aligned[0]!.kind, "HERO");
  assert.equal(aligned[4]!.kind, "DETAIL");
});