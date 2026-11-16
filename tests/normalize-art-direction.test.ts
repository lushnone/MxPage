import test from "node:test";
import assert from "node:assert/strict";
import { alignArtDirectionSections, normalizeArtDirectionPayload } from "@/lib/detail-runs/normalize-art-direction";

test("alignArtDirectionSections pads missing screens from plan copy", () => {
  const planSections = Array.from({ length: 10 }, (_, index) => ({
    title: `屏 ${index}`,
    objective: "展示",
    copy: `文案 ${index}`,
  }));
  const partial = planSections.slice(0, 6).map((section, sectionIndex) => ({
    sectionIndex,
    expression: "photo",
    prompt: "构图",
    textBlocks: [{ text: section.copy, role: "body" }],
  }));
  const aligned = alignArtDirectionSections(partial, 10, planSections);
  assert.equal(aligned.length, 10);
  assert.equal(aligned[9]!.textBlocks[0]!.text, "文案 9");
  assert.equal(aligned[0]!.prompt, "构图");
});

test("normalizeArtDirectionPayload fixes duplicate sectionIndex", () => {
  const raw = {
    sections: [
      { sectionIndex: 0, expression: "photo", prompt: "A", textBlocks: [{ text: "a" }] },
      { sectionIndex: 0, expression: "photo", prompt: "B", textBlocks: [{ text: "b" }] },
    ],
  };
  const normalized = normalizeArtDirectionPayload(raw, { expectedSectionCount: 2, planSections: [{ copy: "fallback-1" }, { copy: "fallback-2" }] }) as { sections: Array<{ sectionIndex: number }> };
  assert.deepEqual(normalized.sections.map(section => section.sectionIndex), [0, 1]);
});