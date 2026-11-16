import { prisma } from "@/lib/db/prisma";
import { matchesBailianTextVisionModelId } from "@/lib/ai/capability-detector";
import { detectTextCompatibility } from "@/lib/ai/text-compatibility";
import { normalizeOpenAiBaseUrl, textProtocols, type ResolvedTextSettings } from "@/lib/ai/text-protocol";
import { isModelAccessDenied, requestErrorMessage } from "@/lib/utils/request-error";
import { providerCredentialFingerprint } from "./provider-runtime";

const probeRoleLabels = { planning: "规划（文本）", vision: "识图（视觉）" } as const;

function probeRole(model: Model): keyof typeof probeRoleLabels | null {
  if (model.isDefaultPlanning) return "planning";
  if (model.isDefaultAnalysis) return "vision";
  return null;
}

function wrapProbeError(model: Model, vision: boolean, error: unknown) {
  const role = probeRole(model);
  const roleLabel = role ? probeRoleLabels[role] : "文本";
  const endpoint = (error as { endpoint?: string })?.endpoint;
  const upstreamError = error as { status?: number; message?: string; code?: string; param?: string; cause?: unknown };
  let detail = isModelAccessDenied(error)
    ? `不是 API Key 坏了：百炼这个 MaaS 工作空间当前不让调「${model.modelId}」（与你在控制台里「没限流」不是一回事，是推理应用未部署/未授权该模型）。你这边探测仍通的是 qwen3.8-omni-flash，规划可暂改它。`
    : requestErrorMessage(error, error instanceof Error ? error.message : "连接检查失败");
  const raw = typeof upstreamError.message === "string" ? upstreamError.message.replace(/^Provider HTTP \d+\s*/i, "").trim() : "";
  if (upstreamError.status && !detail.includes(`HTTP ${upstreamError.status}`)) {
    detail = raw && !detail.includes(raw.slice(0, 40))
      ? `${detail}（HTTP ${upstreamError.status}：${raw.slice(0, 280)}）`
      : `${detail}（HTTP ${upstreamError.status}）`;
  }
  const message = `【${roleLabel}】模型 ${model.modelId} 连接检查失败：${detail}`;
  return Object.assign(new Error(message), {
    code: "PROVIDER_PROBE_FAILED",
    modelId: model.modelId,
    role,
    roleLabel,
    vision,
    endpoint,
    status: upstreamError.status,
    param: upstreamError.param,
    upstreamCode: upstreamError.code,
    cause: error,
  });
}

type Model = {
  id: string; modelId: string; isAvailable: boolean; capabilities: unknown;
  isDefaultPlanning: boolean; isDefaultAnalysis: boolean;
};
type Profile = ResolvedTextSettings & { baseUrl: string; credentialFingerprint: string; vision: boolean };
const pending = new Map<string, Promise<ResolvedTextSettings>>();

export async function prepareTextCompatibility(
  provider: { baseUrl: string; models: Model[] }, apiKey: string,
  options: { forceCompatibilityCheck?: boolean; textModelIds?: string[] } = {},
) {
  const baseUrl = normalizeOpenAiBaseUrl(provider.baseUrl);
  const credentialFingerprint = providerCredentialFingerprint(apiKey)!;
  const resolved: Record<string, ResolvedTextSettings> = {};
  for (const model of provider.models) {
    const required = options.textModelIds ? options.textModelIds.includes(model.modelId) : model.isDefaultPlanning || model.isDefaultAnalysis;
    if (!model.isAvailable || !required) continue;
    const capabilities = model.capabilities as Record<string, unknown>;
    if (!capabilities.text) continue;
    const vision = Boolean(capabilities.vision) || matchesBailianTextVisionModelId(model.modelId);
    const cached = capabilities.__textCompatibility as Profile | undefined;
    if (!options.forceCompatibilityCheck && cached?.baseUrl === baseUrl && cached.credentialFingerprint === credentialFingerprint && cached.vision === vision
      && textProtocols.includes(cached.textProtocol) && ["json_schema", "json_object", "prompt_json"].includes(cached.structuredOutputMode)) {
      resolved[model.modelId] = { textProtocol: cached.textProtocol, structuredOutputMode: cached.structuredOutputMode, ...(cached.responsesStream === false ? { responsesStream: false } : {}), ...(cached.nativePathPrefix ? { nativePathPrefix: cached.nativePathPrefix } : {}) };
      continue;
    }
    const key = JSON.stringify([model.id, baseUrl, credentialFingerprint, vision]);
    let check = pending.get(key);
    if (!check) {
      const role = probeRole(model);
      check = (async () => {
        try {
          const settings = await detectTextCompatibility({
            baseUrl, apiKey, model: model.modelId, vision,
            monitorOperation: role ? `provider_connection_probe:${role}` : "provider_connection_probe",
          });
          // Merge with the latest capability record; never overwrite model defaults.
          await prisma.$transaction(async tx => {
            const current = await tx.modelProfile.findUnique({ where: { id: model.id } });
            if (current) await tx.modelProfile.update({ where: { id: model.id }, data: { capabilities: {
              ...(current.capabilities as Record<string, any>),
              __textCompatibility: { ...settings, baseUrl, credentialFingerprint, vision },
            } } });
          });
          return settings;
        } catch (error) {
          const wrapped = wrapProbeError(model, vision, error);
          console.error("[mxpage] provider text compatibility probe failed", {
            modelId: wrapped.modelId,
            role: wrapped.role,
            vision: wrapped.vision,
            endpoint: wrapped.endpoint,
            message: wrapped.message,
          });
          throw wrapped;
        }
      })().finally(() => pending.delete(key));
      pending.set(key, check);
    }
    try {
      resolved[model.modelId] = await check;
    } catch (error) {
      if ((error as { code?: string })?.code === "PROVIDER_PROBE_FAILED") throw error;
      throw wrapProbeError(model, vision, error);
    }
  }
  return resolved;
}
