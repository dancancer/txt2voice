// 一旦我被更新，请更新我的开头注释
// input: 环境变量/候选端口/fetch 实现
// output: 可访问的 Mastra Studio 地址
// pos: Mastra Studio 入口解析
type StudioFetch = (
  input: URL | RequestInfo,
  init?: RequestInit
) => Promise<{ ok: boolean; status?: number }>;

interface ResolveMastraStudioUrlOptions {
  fetchImpl?: StudioFetch;
  envStudioUrl?: string;
  candidatePorts?: number[];
  timeoutMs?: number;
}

const DEFAULT_MASTRA_STUDIO_PORTS = [4111, 4112, 4113, 4114, 4115];
const DEFAULT_TIMEOUT_MS = 500;

const normalizeStudioOrigin = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const buildCandidateOrigins = (
  envStudioUrl?: string,
  candidatePorts: number[] = DEFAULT_MASTRA_STUDIO_PORTS
): string[] => {
  const origins = candidatePorts.map((port) => `http://localhost:${port}`);
  const explicitOrigin = normalizeStudioOrigin(envStudioUrl);

  if (!explicitOrigin) {
    return origins;
  }

  return [explicitOrigin, ...origins.filter((origin) => origin !== explicitOrigin)];
};

const probeStudioOrigin = async (
  origin: string,
  fetchImpl: StudioFetch,
  timeoutMs: number
): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${origin}/`, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    return response.ok || response.status === 405;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

export const resolveMastraStudioUrl = async ({
  fetchImpl = fetch,
  envStudioUrl,
  candidatePorts = DEFAULT_MASTRA_STUDIO_PORTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ResolveMastraStudioUrlOptions = {}): Promise<string | null> => {
  const origins = buildCandidateOrigins(envStudioUrl, candidatePorts);

  for (const origin of origins) {
    if (await probeStudioOrigin(origin, fetchImpl, timeoutMs)) {
      return origin;
    }
  }

  return null;
};
