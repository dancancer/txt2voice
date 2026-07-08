import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GenerationStatusCard } from "@/components/audio-generation/AudioGenerationStatusCards";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value?: number }) => <div data-progress={value || 0} />,
}));

jest.mock("lucide-react", () => {
  const Icon = () => <span />;
  return {
    AlertCircle: Icon,
    CheckCircle: Icon,
    FileText: Icon,
    Loader2: Icon,
    Play: Icon,
    Volume2: Icon,
    Zap: Icon,
  };
});

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

describe("AudioGenerationStatusCards", () => {
  it("should render recent runtime events in generation status card", async () => {
    const { container, root } = await mount(
      <GenerationStatusCard
        state={{
          status: "processing",
          progress: 64,
          message: "音频生成中",
          recentRuntimeEvents: [
            {
              seq: 1,
              kind: "audio_batch_pass",
              title: "音频批次完成",
              detail: "pass-1 · 成功 3 · 失败 1",
              status: "info",
              progress: 64,
              createdAt: "2026-03-22T10:00:00.000Z",
            },
          ],
        }}
        isGenerating
      />
    );

    expect(container.textContent).toContain("音频生成中");
    expect(container.textContent).toContain("最近进展");
    expect(container.textContent).toContain("音频批次完成");
    expect(container.textContent).toContain("pass-1 · 成功 3 · 失败 1");

    await unmount(root, container);
  });
});
