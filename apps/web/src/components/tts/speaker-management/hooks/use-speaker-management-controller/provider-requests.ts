// 一旦我被更新，请更新我的开头注释
// input: provider 状态接口响应
// output: provider 状态请求工具
// pos: TTS speaker management
import type { ProviderServiceStatus } from "../../types";

export async function fetchProviderStatusesRequest(): Promise<ProviderServiceStatus[]> {
  const response = await fetch("/api/tts/providers/status", {
    cache: "no-store",
  });
  const data = await response.json();

  if (data.success && Array.isArray(data.data?.providers)) {
    return data.data.providers as ProviderServiceStatus[];
  }

  return [];
}
