/** 百炼 / DashScope 兼容端点上的混合思考模型在 workflow 结构化输出时需关闭思考，否则 JSON 常落在 reasoning 里。 */
export function dashscopeStructuredRequestExtras(baseUrl: string, model: string, hasSchema: boolean): { enable_thinking?: boolean } {
  if (!hasSchema) return {};
  let host = "";
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return {};
  }
  if (!/aliyuncs\.com$/.test(host) && !host.includes("dashscope")) return {};
  // token-plan 上 qwen3.7-plus / qwen3.8-flash 等也会走思考字段，正文常变成 [] 或 {}。
  return { enable_thinking: false };
}