import { ZodError } from "zod";
import { networkErrorCode } from "./network-error";

function providerHttpStatus(error: unknown) {
  const value = error as { status?: number; statusCode?: number; message?: string } | null;
  return value?.status ?? value?.statusCode ?? Number(value?.message?.match(/^(?:HTTP\s+)?([45]\d\d)\b/i)?.[1] || 0);
}

function probeUpstreamText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (current && typeof current === "object" && "message" in current) {
      const message = (current as { message?: string }).message;
      if (typeof message === "string" && message.trim()) parts.push(message);
    }
    current = (current as { cause?: unknown })?.cause;
  }
  return parts.join(" ");
}

export function isModelAccessDenied(error: unknown): boolean {
  const text = probeUpstreamText(error).toLowerCase();
  const status = providerHttpStatus(error)
    || providerHttpStatus((error as { cause?: unknown })?.cause)
    || Number(text.match(/\b403\b/)?.[0] || 0);
  return status === 403 && /access to model denied|not eligible|eligible for using the model|model access denied|模型.*(?:未开通|无权限)|无权.*模型/.test(text);
}

// Only an explicit 400 schema rejection proves that generation did not start.
// Do not treat timeouts, response parse failures or other 4xx as safe to resend.
export function isStructuredSchemaRejection(error: unknown) {
  const message = (error as { message?: string } | null)?.message || "";
  return providerHttpStatus(error) === 400 && /invalid (?:json )?schema/i.test(message) && /response_format|json_schema/i.test(message);
}

// Keep field-level business feedback, but never render SDK bodies, HTML or stacks.
export function requestErrorMessage(error: unknown, fallback = "操作暂未完成，请稍后重试。已有结果不会被清除。") {
  const value = error as { code?: string; message?: string } | null;
  if (value?.code === "MODEL_REQUEST_TIMEOUT") return "模型请求超时，结果暂未确认。请核对调用记录；只有明确确认可能再次计费后才会重新请求。";
  if (value?.code === "MODEL_REQUEST_FAILED" || value?.code === "IMAGE_REQUEST_FAILED") return "模型请求失败或响应中断，结果暂未确认。请核对调用记录；只有明确确认可能再次计费后才会重新请求。";
  if (value?.code === "IMAGE_DOWNLOAD_FAILED") return "图片已生成，但下载失败。请使用“仅恢复已有图片”重新下载，不需要重新生图。";
  if (value?.code === "IMAGE_RESULT_QUERY_FAILED") return "图片结果查询失败，上游任务编号已保存。请使用“仅恢复已有图片”查询原任务，不会重新提交生图。";
  if (value?.code === "IMAGE_TASK_PENDING") return "图片结果查询暂未完成，上游任务编号已保存。继续任务只查询原结果，不会重新提交生图。";
  if (value?.code === "P2025") return "该项目或任务已不存在，请返回我的作品。";
  if (value?.code === "ENOENT") return "所需素材文件已不存在，请重新上传素材后继续。";
  if (error instanceof ZodError) {
    const text = (error as Error).message || "";
    if (/结构化 JSON 校验失败|模型返回摘录/.test(text)) return `${text.slice(0, 1500)}当前步骤已暂停，已有结果已保留。`;
    const fields = error.issues.slice(0, 4).map(issue => issue.path.join(".") || "root").join("、");
    return fields
      ? `返回的数据格式不完整（字段：${fields}），当前步骤已暂停，已有结果已保留。`
      : "返回的数据格式不完整，当前步骤已暂停，已有结果已保留。";
  }
  if (error instanceof SyntaxError) return "服务返回的数据无法读取，请检查服务状态后继续。";
  const message = probeUpstreamText(error) || value?.message || "";
  const status = providerHttpStatus(error) || providerHttpStatus((error as { cause?: unknown })?.cause);
  if (status === 400 && /invalidparameter|invalid_parameter|max_tokens|max_completion_tokens/i.test(`${value?.code || ""} ${message}`)) {
    return `模型服务拒绝了请求参数（HTTP 400）${message ? `：${message.replace(/^<\d+>\s*/, "").slice(0, 500)}` : "，请检查输出 token 上限等设置。"}`;
  }
  if (isStructuredSchemaRejection(error)) return "模型服务拒绝了请求的数据格式，尚未开始生成。请更新应用后继续任务，无需更换 API Key。";
  const network = networkErrorCode(error);
  if (/timeout|timed out|aborterror|\b504\b/i.test(message) || /TIMEOUT|ETIMEDOUT/.test(network || "")) return "服务响应超时，结果暂未确认。请先查看任务进度，避免重复提交。";
  if (/fetch failed|failed to fetch|network error|load failed/i.test(message) || network) return "连接暂时中断，请检查网络。已保存的结果仍可查看，请勿重复提交任务。";
  if (
    status === 403
    && /access to model denied|not eligible for using the model|model access denied|模型.*(?:未开通|无权限|不可用)|无权.*模型/i.test(message)
  ) {
    return "当前 API Key 有效，但该工作空间未开通此模型的调用权限。请在百炼控制台开通对应模型，或把默认改为已开通的模型（如 qwen-plus / qwen3.8-flash）。";
  }
  if ([401, 403].includes(status) || /\bunauthorized\b|\binvalid_api_key\b|\b(?:invalid|incorrect|expired|revoked)\s+(?:api[ _-]?)?(?:key|token)\b/i.test(message)) return "模型服务鉴权失败，请检查 API 配置。";
  if (/rate limit|\b429\b/i.test(message)) return "模型服务当前繁忙，请稍后继续。";
  if (/\b50[023]\b/.test(message)) return "模型服务暂时不可用，已有结果已保留，请稍后继续。";
  if (/sections\[\d+\]\.textBlocks|Typesetting|内容覆盖\./i.test(message)) return "草稿已保留。点击继续可自动整理文案与排版，已有图片不会重复生成。";
  if (/[\u3400-\u9fff]/.test(message) && !/<[a-z!/]|\n\s*at\s|prisma\.|SELECT\s|INSERT\s|sk-[a-z0-9]/i.test(message)) return message.slice(0, 1500);
  return fallback;
}

export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = "ApiRequestError"; }
}

export async function readApiResponse<T = any>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.success === true && "data" in payload) return payload.data as T;
  const fallback = response.status === 404 ? "该项目或任务已不存在，请返回我的作品。"
    : response.status === 502 || response.status === 503 || response.status === 504 ? "服务暂时无法响应，请先查看任务进度，避免重复提交。"
    : "服务返回的数据无法读取，请稍后刷新。已有结果不会被清除。";
  throw new ApiRequestError(response.status, payload?.error?.code || "INVALID_RESPONSE", requestErrorMessage({ status: response.status, message: payload?.error?.message }, fallback));
}

// Read-only polling may time out and reconnect. Mutations are never replayed here.
export async function fetchApiProgress<T = any>(url: string, signal?: AbortSignal, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, timeoutMs);
  try { return await readApiResponse<T>(await fetch(url, { cache: "no-store", signal: controller.signal })); }
  catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new ApiRequestError(504, "POLL_TIMEOUT", "进度更新暂时超时，正在重新连接；后台任务不会因此重新提交。");
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}
