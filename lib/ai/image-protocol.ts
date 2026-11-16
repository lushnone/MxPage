import catalog from "./catalog/evolink-images.json";
export type ImageProtocol = "openai_images" | "evolink_tasks" | "gemini_native" | "gemini_proxy";
export type ImageContract = { source: string; required: string[]; properties: Record<string, { enum?: (string | number)[]; default?: unknown; maxItems?: number; minItems?: number; maxLength?: number; pattern?: string; ratios?: string[] }> };
export type ImageModelSettings = { protocol: ImageProtocol; contract?: ImageContract };
export type ImageSettings = { imageProtocol?: ImageProtocol; imageModelSettings?: Record<string, ImageModelSettings>; legacyImageRouting?: boolean; onImageSuccess?: (model: string, settings: ImageModelSettings) => Promise<void> };

export function evoLinkImageContract(model: string): ImageContract | undefined {
  return catalog.find(entry => entry.models.includes(model)) as ImageContract | undefined;
}

// Kept only for tasks snapshotted before per-model image routing existed.
export function isEvoLinkTaskModel(model: string) {
  return model === "gpt-image-2.5-flare" || model === "gpt-image-2.5-sunburst";
}

export function resolveImageModel(baseUrl: string, model: string, settings: ImageSettings = {}): ImageModelSettings {
  if (settings.imageModelSettings?.[model]) return settings.imageModelSettings[model];
  const gemini = /gemini.*image|nano-banana|banana/i.test(model);
  if (settings.legacyImageRouting) return { protocol: gemini ? "gemini_proxy" : (settings.imageProtocol ?? resolveImageProtocol(baseUrl)) === "evolink_tasks" && isEvoLinkTaskModel(model) ? "evolink_tasks" : "openai_images" };
  // Unknown EvoLink Gemini models must fail contract validation, not inherit a
  // Gemini proxy URL from their name. Saved successful routes above stay intact.
  if (resolveImageProtocol(baseUrl) === "evolink_tasks") {
    const contract = evoLinkImageContract(model);
    if (contract || gemini) return { protocol: "evolink_tasks", ...(contract ? { contract } : {}) };
  }
  if (new URL(baseUrl).hostname === "generativelanguage.googleapis.com" || /\/v1beta\/?$/.test(new URL(baseUrl).pathname) && !/\/google\//.test(baseUrl)) return { protocol: "gemini_native" };
  return { protocol: gemini ? "gemini_proxy" : "openai_images" };
}

// Documented API origin, not a provider display name or model alias. Unknown
// origins keep the official Images protocol; never probe by generating an image.
export function resolveImageProtocol(baseUrl: string): ImageProtocol {
  const url = new URL(baseUrl);
  return url.origin === "https://api.evolink.ai" && /^\/(?:v1\/?|)$/.test(url.pathname)
    ? "evolink_tasks" : "openai_images";
}

export function isImageEndpointError(error: unknown) {
  return (error as { code?: string })?.code === "IMAGE_ENDPOINT_UNAVAILABLE";
}

/** Token Plan 订阅域：规划/对话走 compatible-mode，生图固定走 MaaS multimodal-generation（官方不含 OpenAI Images 路径）。 */
export function usesMaasMultimodalImageEndpoint(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.toLowerCase().includes("token-plan");
  } catch {
    return false;
  }
}

export function maasMultimodalImageUrl(baseUrl: string): string {
  return `${new URL(baseUrl).origin}/api/v1/services/aigc/multimodal-generation/generation`;
}

/** OpenAI 兼容 size 用 x；DashScope parameters.size 用 *。 */
export function openAiImageSizeToDashScope(size: string): string {
  if (!size || size === "auto") return size;
  return size.replace(/x/gi, "*");
}

/** OpenAI 兼容 Images：部分 MaaS（如百炼 compatible-mode）有参考图时只认 /images/generations + JSON image，不提供 /images/edits。 */
export function openAiImagesJsonReferenceBase(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (usesMaasMultimodalImageEndpoint(baseUrl)) return false;
    return /aliyuncs\.com$/.test(host) || host.includes("dashscope");
  } catch {
    return false;
  }
}

export function openAiImagesReferenceLimit(model: string): number {
  return /qwen-image-3/i.test(model) ? 3 : 10;
}

/** 全部生图/改图共用的客户端等待上限；仅按服务根地址区分慢通道，不散落在各业务模块。 */
export function imageGenerationTimeoutMs(baseUrl: string): number {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (/aliyuncs\.com$/.test(host) || host.includes("dashscope")) return 600_000;
  } catch { /* ignore */ }
  return 180_000;
}
