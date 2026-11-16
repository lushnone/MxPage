import { NextRequest } from "next/server";
import { z } from "zod";
import { normalizeOpenAiBaseUrl, resolvedTextSettings, textEndpoint } from "@/lib/ai/text-protocol";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { fail, handleRouteError, ok } from "@/lib/utils/route";
export async function POST(request: NextRequest) {
  let endpoint: string | undefined;
  try {
    return await withProviderCredentials(request, async () => {
      const { provider } = await getProviderAdapter(undefined, undefined, { forceCompatibilityCheck: true });
      const model = provider.models.find(item => item.isDefaultPlanning);
      if (!model || !model.isAvailable) return fail("PLANNING_MODEL_REQUIRED", "请先保存配置并选择可用的规划模型。", null, 400);
      const baseUrl = normalizeOpenAiBaseUrl(provider.baseUrl);
      const settings = resolvedTextSettings(provider, model.modelId);
      endpoint = textEndpoint(baseUrl, settings.textProtocol, model.modelId, settings.nativePathPrefix);
      const checkedModels = provider.models
        .filter(item => item.isAvailable && (item.isDefaultPlanning || item.isDefaultAnalysis))
        .map(item => ({
          modelId: item.modelId,
          roleLabel: [
            item.isDefaultPlanning ? "规划（文本）" : null,
            item.isDefaultAnalysis ? "识图（视觉）" : null,
          ].filter(Boolean).join(" / "),
          withVisionInput: Boolean((item.capabilities as Record<string, unknown>)?.vision)
            && (item.isDefaultAnalysis || item.isDefaultPlanning),
        }));
      return ok({
        baseUrl,
        endpoint,
        modelId: model.modelId,
        transport: `${settings.textProtocol} / ${settings.structuredOutputMode}`,
        compatible: true,
        models: provider.textModelSettings,
        checkedModels,
      });
    });
  } catch (error) {
    endpoint ??= (error as { endpoint?: string })?.endpoint;
    const failedModel = (error as { modelId?: string })?.modelId;
    const failedRole = (error as { role?: "planning" | "vision" })?.role;
    const failedRoleLabel = (error as { roleLabel?: string })?.roleLabel;
    const root = (error as Error & { cause?: unknown })?.cause ?? error;
    if (failedModel) {
      console.error("[mxpage] agent-compatibility check failed", { failedModel, failedRole, endpoint, error });
    }
    if ((error as { status?: number })?.status === 404 || (root as { status?: number })?.status === 404) {
      return fail("PROVIDER_ENDPOINT_NOT_FOUND", "模型服务返回 404：请检查已保存的 API 地址，以及规划模型是否在该服务中可用。", { endpoint, failedModel, failedRole, failedRoleLabel }, 502);
    }
    if (root instanceof SyntaxError || root instanceof z.ZodError) {
      return fail("PROVIDER_STRUCTURED_OUTPUT_INVALID", "模型已响应，但结果不符合任务要求。请使用支持结构化输出的模型后重新探测。", { endpoint, failedModel, failedRole, failedRoleLabel }, 502);
    }
    if ((error as { code?: string })?.code === "PROVIDER_PROBE_FAILED" && error instanceof Error) {
      return fail("PROVIDER_PROBE_FAILED", error.message, { endpoint: endpoint ?? (error as { endpoint?: string }).endpoint, failedModel, failedRole, failedRoleLabel }, 502);
    }
    return handleRouteError(error);
  }
}
