/** 百炼单次输出约 8192 token，10 屏分镜 JSON 易截断；按批请求，每批控制在较小屏数。 */
export const ART_DIRECTION_BATCH_SIZE = 5;

/** 百炼 compatible-mode：逐屏请求，避免 8192 token 一次写多屏 JSON 被截断。 */
export function artDirectionBatchSize(baseUrl: string, expected: number): number {
  if (!providerCapsStructuredOutput(baseUrl)) return ART_DIRECTION_BATCH_SIZE;
  if (expected > ART_DIRECTION_BATCH_SIZE) return 1;
  return ART_DIRECTION_BATCH_SIZE;
}

export function artDirectionBatchRanges(expected: number, batchSize = ART_DIRECTION_BATCH_SIZE): Array<{ start: number; end: number }> {
  if (expected <= 0) return [];
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < expected; start += batchSize) {
    ranges.push({ start, end: Math.min(expected, start + batchSize) });
  }
  return ranges;
}

export function providerCapsStructuredOutput(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return /aliyuncs\.com$/.test(host) || host.includes("dashscope");
  } catch {
    return false;
  }
}

export function shouldBatchArtDirection(baseUrl: string, expected: number): boolean {
  if (expected <= ART_DIRECTION_BATCH_SIZE) return false;
  return providerCapsStructuredOutput(baseUrl);
}

export function artDirectionRequestKey(start: number, endExclusive: number, expected: number): string {
  if (start === 0 && endExclusive === expected) return "ART_DIRECTION";
  return `ART_DIRECTION:${start}-${endExclusive - 1}`;
}

export function artDirectionBatchStageLabel(start: number, endExclusive: number, expected: number): string {
  if (start === 0 && endExclusive === expected) return "设计视觉分镜";
  return `设计视觉分镜（第 ${start + 1}–${endExclusive} 屏）`;
}