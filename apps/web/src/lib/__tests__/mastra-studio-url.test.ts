// 一旦我被更新，请更新我的开头注释
// input: Studio 候选地址/探测 fetch 实现
// output: 可访问的 Mastra Studio 地址
// pos: Mastra Studio 地址解析测试
import { resolveMastraStudioUrl } from "@/lib/mastra-studio-url";

describe("resolveMastraStudioUrl", () => {
  it("should fall back to the next local port when the default port is unavailable", async () => {
    const fetchImpl = jest.fn(async (input: URL | RequestInfo) => {
      const url = String(input);

      if (url === "http://localhost:4111/") {
        throw new Error("connect ECONNREFUSED");
      }

      return {
        ok: true,
      } as Response;
    });

    const url = await resolveMastraStudioUrl({
      fetchImpl,
      envStudioUrl: undefined,
      candidatePorts: [4111, 4112],
      timeoutMs: 50,
    });

    expect(url).toBe("http://localhost:4112");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4111/",
      expect.objectContaining({
        method: "HEAD",
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4112/",
      expect.objectContaining({
        method: "HEAD",
      })
    );
  });

  it("should prefer a reachable explicit studio url before probing local defaults", async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true }) as Response);

    const url = await resolveMastraStudioUrl({
      fetchImpl,
      envStudioUrl: "http://127.0.0.1:5123",
      candidatePorts: [4111, 4112],
      timeoutMs: 50,
    });

    expect(url).toBe("http://127.0.0.1:5123");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:5123/",
      expect.objectContaining({
        method: "HEAD",
      })
    );
  });

  it("should return null when no candidate studio is reachable", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });

    const url = await resolveMastraStudioUrl({
      fetchImpl,
      envStudioUrl: undefined,
      candidatePorts: [4111, 4112],
      timeoutMs: 50,
    });

    expect(url).toBeNull();
  });
});
