import type { VisualPreferenceBrief } from "./visual-preference-brief";

const MINIMAL_HINT = /(?:不要|少|减|尽量少|精简|极简).{0,12}(?:字|文案|文字)|channel|chanel|高级感|高级质感|图内.{0,6}少|字少一点|less text|minimal copy/i;
const BRAND_STRIP_HINT = /(?:不要|禁止|去除|去掉|移除|无).{0,20}(?:logo|徽标|商标|品牌)|alicetod|alice\s*tod|第三方.{0,8}品牌|参考图.{0,12}logo/i;

export type TextDensity = "minimal" | "standard";

export function detectTextDensity(userInstruction: string, brief?: Pick<VisualPreferenceBrief, "textStyle">): TextDensity {
  if (brief?.textStyle === "minimal" || brief?.textStyle === "standard") return brief.textStyle;
  return MINIMAL_HINT.test(userInstruction) ? "minimal" : "standard";
}

export function shouldSkipHeroToDetailMerge(userInstruction: string, brief?: Pick<VisualPreferenceBrief, "textStyle">) {
  return detectTextDensity(userInstruction, brief) === "minimal";
}

export function identityAuthorityNote(projectName: string, projectDescription: string, recognitionName?: string) {
  const name = projectName.trim();
  const rec = (recognitionName || "").trim();
  if (!name || !rec) return undefined;
  const norm = (value: string) => value.replace(/\s/gu, "").toLowerCase();
  if (norm(name).includes(norm(rec)) || norm(rec).includes(norm(name).slice(0, Math.min(8, name.length)))) return undefined;
  return `用户填写的产品名称为「${name}」；识图草稿名称为「${rec}」。售卖叙事、画面文案与生图约束以用户填写为准，不得把识图草稿中的第三方品牌当作本次售卖品牌。${projectDescription.trim() ? `用户描述：${projectDescription.trim().slice(0, 300)}` : ""}`;
}

export function buildReferenceRolesPrefix(
  productCount: number,
  styleCount: number,
  brief: VisualPreferenceBrief | undefined,
  userInstruction: string,
) {
  if (!productCount && !styleCount) return "";
  const strip = brief?.referenceImageUse?.trim()
    || (BRAND_STRIP_HINT.test(userInstruction)
      ? "前几张上传图仅作材质、工艺、填充物形态与本白色泽参考；须重新设计墙面、地面与卧室场景，不得复刻参考图上的第三方品牌名、logo、蓝边套件印花或婚庆袋字样。"
      : "");
  if (styleCount > 0) {
    return [
      `参考图片按顺序：前 ${productCount} 张为商品身份与外观证据${strip ? `；${strip}` : ""}`,
      `其后 ${styleCount} 张仅为风格参考（光线、色调、构图、信息密度），其中的文字、品牌、承诺与商品结构不可照抄；商品结构以原始商品图为准。`,
    ].join("");
  }
  if (productCount > 0) {
    return strip
      ? `参考图片（共 ${productCount} 张）：${strip}`
      : `参考图片（共 ${productCount} 张）为商品身份与外观证据；重新设计背景与场景时须保持与用户确认的商品事实一致。`;
  }
  return "";
}

export function artDirectionSystemSuffix(brief: VisualPreferenceBrief | undefined, textDensity: TextDensity) {
  const lines = ["visualPreferenceBrief 与用户视觉契约优先：每屏 prompt 必须体现与本屏相关的约束，且不得矛盾。"];
  if (textDensity === "minimal") {
    lines.push("图内信息密度为 minimal：HERO 每屏最多 1 个标题 textBlock + 2 个短句 body；DETAIL 每屏最多 1 标题 + 4 短句；禁止把整页规划 copy 全部塞进 textBlocks。");
  }
  if (brief?.globalConstraints?.length) lines.push(`全局约束：${brief.globalConstraints.join("；")}`);
  return lines.join("\n");
}

type StoryboardSection = { sectionIndex: number; textBlocks: Array<{ text: string }> };
type PlanSlot = { kind: string };

export function validateV4TextDensity(
  artSections: StoryboardSection[],
  planSections: PlanSlot[],
  textDensity: TextDensity,
): string | undefined {
  if (textDensity !== "minimal") return undefined;
  for (const section of artSections) {
    const kind = planSections[section.sectionIndex]?.kind || "DETAIL";
    const count = section.textBlocks.length;
    const limit = kind === "HERO" ? 3 : 5;
    if (count > limit) return `极简字模式下第 ${section.sectionIndex + 1} 屏（${kind}）有 ${count} 段图内文案，超过 ${limit} 段上限。请点「仅重试视觉分镜」，规划会保留。`;
  }
  return undefined;
}

export function truncateTextBlocksForMinimal(
  textBlocks: Array<{ text: string; role?: string }>,
  kind: "HERO" | "DETAIL",
): Array<{ text: string; role?: string }> {
  if (!textBlocks.length) return textBlocks;
  const headline = textBlocks.find(b => /title|headline/i.test(b.role || "")) || textBlocks[0];
  const rest = textBlocks.filter(b => b !== headline);
  const bodyLimit = kind === "HERO" ? 2 : 4;
  return [headline, ...rest.slice(0, bodyLimit)];
}