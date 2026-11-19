import assert from "node:assert/strict";
import test from "node:test";
import { fallbackVisualPreferenceBrief, formatBriefForImagePrompt, briefContractHeader } from "../lib/detail-runs/visual-preference-brief";
import { shouldSkipHeroToDetailMerge, buildReferenceRolesPrefix } from "../lib/detail-runs/visual-execution-policy";

test("fallback brief picks minimal density and brand strip hints", () => {
  const brief = fallbackVisualPreferenceBrief({
    userInstruction: "不要 AliceTod 和 logo\nChannel 风格，不要太多字\n背景墙面地面都要换",
    requirements: ["移除所有图片中的 AliceTod 品牌 Logo"],
    productName: "纯手工桑蚕丝被",
    description: "本白贡缎",
    sectionCount: 10,
  });
  assert.equal(brief.textStyle, "minimal");
  assert.ok(brief.forbiddenVisibleText.some(text => /alicetod/i.test(text)));
  assert.match(brief.referenceImageUse, /品牌|logo/i);
});

test("formatBriefForImagePrompt appends contract block per frame", () => {
  const brief = fallbackVisualPreferenceBrief({
    userInstruction: "不要 logo",
    requirements: [],
    productName: "测试",
    description: "",
    sectionCount: 2,
  });
  const block = formatBriefForImagePrompt(brief, 0, "HERO");
  assert.ok(block.startsWith(briefContractHeader()));
  assert.match(block, /Forbidden in image/);
});

test("minimal mode skips hero to detail merge heuristically", () => {
  assert.equal(shouldSkipHeroToDetailMerge("图里要高级，channel风格，不要太多字"), true);
  assert.equal(shouldSkipHeroToDetailMerge("写满参数表"), false);
});

test("reference roles prefix includes strip guidance when user forbids branding", () => {
  const brief = fallbackVisualPreferenceBrief({
    userInstruction: "不要 alicetod logo",
    requirements: [],
    productName: "被",
    description: "",
    sectionCount: 4,
  });
  const prefix = buildReferenceRolesPrefix(3, 0, brief, "不要 alicetod logo");
  assert.match(prefix, /材质|品牌|logo/i);
});