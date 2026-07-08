import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import LLMSettingsPage from "@/app/settings/llm/page";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

const mount = async (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return { container, root };
};

const unmount = async (root: Root, container: HTMLElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe("llm settings page", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          models: [
            {
              id: "model-1",
              name: "Qwen Local",
              provider: "custom",
              baseURL: "http://192.168.88.9:8028/v1",
              model: "Qwen3.5-9B-GGUF-Q4_K_M",
              isDefault: true,
              isActive: true,
              sortOrder: 0,
              hasApiKey: false,
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
            },
          ],
        },
      }),
    } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("loads persisted llm models and renders them", async () => {
    const { container, root } = await mount(<LLMSettingsPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("LLM 设置");
    expect(container.textContent).toContain("Qwen Local");
    expect(container.textContent).toContain("Key 为空");

    await unmount(root, container);
  });
});
