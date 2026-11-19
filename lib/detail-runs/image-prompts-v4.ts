import { cleanCustomerDirection, confirmedAnswerCopyRules } from "./customer-copy";
import type { VisualPreferenceBrief } from "./visual-preference-brief";
import { formatBriefForImagePrompt, resolveTextStyle } from "./visual-preference-brief";
import { truncateTextBlocksForMinimal } from "./visual-execution-policy";

type Section = { order: number; visualPrompt: string; type?: string };
type Direction = { sectionIndex: number; prompt: string; textBlocks: Array<{ text: string; role?: string }> };

export type MaterializeImagePromptOptions = {
  brief?: VisualPreferenceBrief;
  userInstruction?: string;
  sectionKinds?: Array<"HERO" | "DETAIL">;
};

// Persistence and paid generation must consume the same finalized storyboard.
// Reading sections before saving the storyboard leaves stale planning prompts.
export function materializeImagePrompts<S extends Section, D extends Direction>(
  sections: S[],
  directions: D[],
  confirmedEstimates = false,
  options: MaterializeImagePromptOptions = {},
) {
  const byIndex = new Map(directions.map(direction => [direction.sectionIndex, confirmedEstimates ? cleanCustomerDirection(direction) : direction]));
  if (byIndex.size !== directions.length || directions.length !== sections.length) {
    throw new Error("视觉分镜编号重复或数量不匹配，未发起图片请求。");
  }
  const textStyle = resolveTextStyle(options.brief, options.userInstruction || "");
  return sections.map(section => {
    const artDirection = byIndex.get(section.order);
    if (!artDirection) throw new Error(`缺少第 ${section.order + 1} 张图片的视觉分镜，未发起图片请求。`);
    const kind = options.sectionKinds?.[section.order]
      || (section.type === "HERO" ? "HERO" : "DETAIL");
    let textBlocks = artDirection.textBlocks;
    if (textStyle === "minimal") textBlocks = truncateTextBlocksForMinimal(textBlocks, kind);
    const contract = options.brief ? `${formatBriefForImagePrompt(options.brief, section.order, kind)}\n` : "";
    const exactCopyBlock = textStyle === "minimal" && textBlocks.length
      ? "Use the following Exact copy as the sole source of visible text. Render only the lines listed; omit any other planned copy.\n"
      : "Use the following Exact copy as the sole source of visible text. It overrides any conflicting wording in the visual description; do not rephrase, omit or add claims.\n";
    return {
      ...section,
      artDirection,
      visualPrompt: `${artDirection.prompt}\n${contract}${confirmedEstimates ? `${confirmedAnswerCopyRules}\n` : ""}${exactCopyBlock}Exact copy:\n${textBlocks.map(block => block.text).join("\n")}`,
    };
  });
}