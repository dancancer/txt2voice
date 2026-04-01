import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import TasksPage from "../tasks/page";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
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

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value?: number }) => <div data-progress={value || 0} />,
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <span className={className} />;
  return {
    RefreshCw: Icon,
    Clock: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    Loader2: Icon,
    AlertCircle: Icon,
    RotateCcw: Icon,
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

describe("tasks page", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "task-script-1",
            bookId: "book-1",
            bookTitle: "脚本书籍",
            taskType: "SCRIPT_GENERATION",
            status: "completed",
            progress: 100,
            message: "台本生成完成",
            metadata: {
              llmMetrics: {
                submitted: 5,
                completed: 3,
                failed: 1,
                retried: 2,
                averageWaitMs: 120,
                averageLatencyMs: 840,
                providers: [
                  {
                    provider: "openai",
                    submitted: 5,
                    completed: 3,
                    failed: 1,
                    retried: 2,
                    averageWaitMs: 120,
                    averageLatencyMs: 840,
                  },
                ],
              },
            },
            createdAt: "2026-03-22T10:00:00.000Z",
            updatedAt: "2026-03-22T10:01:00.000Z",
            completedAt: "2026-03-22T10:02:00.000Z",
          },
          {
            id: "task-audio-1",
            bookId: "book-2",
            bookTitle: "音频书籍",
            taskType: "AUDIO_GENERATION",
            status: "completed",
            progress: 100,
            message: "音频生成完成",
            metadata: {
              audioChildJobMetrics: {
                submitted: 4,
                completed: 4,
                failed: 0,
                retried: 1,
                averageWaitMs: 40,
                averageLatencyMs: 1500,
                providers: [
                  {
                    provider: "voxcpm",
                    submitted: 4,
                    completed: 4,
                    failed: 0,
                    retried: 1,
                    averageWaitMs: 40,
                    averageLatencyMs: 1500,
                  },
                ],
              },
            },
            createdAt: "2026-03-22T10:03:00.000Z",
            updatedAt: "2026-03-22T10:04:00.000Z",
            completedAt: "2026-03-22T10:05:00.000Z",
          },
        ],
      }),
    } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("should render llm and tts child job summaries inside task cards", async () => {
    const { container, root } = await mount(<TasksPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("LLM 子任务");
    expect(container.textContent).toContain("TTS 子任务");
    expect(container.textContent).toContain("openai");
    expect(container.textContent).toContain("voxcpm");
    expect(container.textContent).toContain("已提交 5");
    expect(container.textContent).toContain("重试 1");

    await unmount(root, container);
  });
});
