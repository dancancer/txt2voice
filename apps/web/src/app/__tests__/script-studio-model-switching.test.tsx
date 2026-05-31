import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ScriptStudioPageContainer } from "@/app/books/[id]/studio/script/page-container";
const { buildSegmentFailedReviewTaskLinks } = jest.requireActual(
  "@/app/books/[id]/studio/script/page-container/hooks/useScriptStudioData"
);
const mockSearchParams = new URLSearchParams();
const setMockNodeParam = (value: string | null) => {
  if (value) {
    mockSearchParams.set("node", value);
    return;
  }

  mockSearchParams.delete("node");
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "book-1" }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
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

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("lucide-react", () => ({
  FileText: () => <span>FileText</span>,
}));

const mockSegment = {
  id: "segment-1",
  content: "这是当前段落的正文",
  wordCount: 12,
  segmentIndex: 0,
  orderIndex: 0,
};

const mockSegmentWithoutFailure = {
  id: "segment-2",
  content: "这是没有失败记录的段落",
  wordCount: 10,
  segmentIndex: 1,
  orderIndex: 1,
};

const mockSegmentMeta = {
  chapterTitle: "第一章",
  label: "段落 #1",
};

const mockSegmentWithoutFailureMeta = {
  chapterTitle: "第一章",
  label: "段落 #2",
};

const mockFailedReviewTaskLink = {
  taskId: "task-failed-1",
  reviewUrl: "/books/book-1/review#task-task-failed-1",
  updatedAt: "2026-04-15T06:42:45.000Z",
};

jest.mock("@/app/books/[id]/studio/script/components", () => ({
  BookWorkbench: ({
    llmModels,
    selectedLLMModelId,
    onSelectLLMModelId,
    onGenerateBookScript,
  }: {
    llmModels: Array<{ id: string; displayName?: string; name?: string }>;
    selectedLLMModelId?: string;
    onSelectLLMModelId: (id: string) => void;
    onGenerateBookScript: () => void;
  }) => (
    <div>
      <select
        aria-label="台本模型"
        value={selectedLLMModelId || ""}
        onChange={(event) => onSelectLLMModelId(event.target.value)}
      >
        {llmModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.displayName || model.name || model.id}
          </option>
        ))}
      </select>
      <button type="button" onClick={onGenerateBookScript}>
        全书台本生成
      </button>
    </div>
  ),
  ChapterWorkbench: ({
    segments,
    failedReviewTaskBySegment,
  }: {
    segments: Array<{ id: string }>;
    failedReviewTaskBySegment?: Map<
      string,
      { taskId: string; reviewUrl: string; updatedAt: string }
    >;
  }) => (
    <div>
      {segments.map((segment) => {
        const taskLink = failedReviewTaskBySegment?.get(segment.id);
        return (
          <div key={segment.id} data-testid={`segment-row-${segment.id}`}>
            <span>{segment.id}</span>
            {taskLink ? <a href={taskLink.reviewUrl}>查看质检失败</a> : null}
          </div>
        );
      })}
    </div>
  ),
  DocumentTree: ({
    onSelect,
  }: {
    onSelect: (node: { type: "book" | "chapter" | "segment"; id: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelect({ type: "book", id: "book-1" })}>
        选择整书
      </button>
      <button
        type="button"
        onClick={() => onSelect({ type: "chapter", id: "chapter-1" })}
      >
        选择章节
      </button>
      <button
        type="button"
        onClick={() => onSelect({ type: "segment", id: "segment-1" })}
      >
        选择段落
      </button>
    </div>
  ),
  SegmentWorkbench: ({
    failedReviewTask,
    onRegenerateScript,
  }: {
    failedReviewTask?: { taskId: string; reviewUrl: string; updatedAt: string } | null;
    onRegenerateScript: () => void;
  }) => (
    <div>
      <button type="button" onClick={onRegenerateScript}>
        当前段落台本生成
      </button>
      {failedReviewTask ? <a href={failedReviewTask.reviewUrl}>查看质检失败</a> : null}
    </div>
  ),
  EditSentenceModal: () => null,
  GenerationProgress: ({
    generationStatus,
    generationProgress,
    generationEvents,
  }: {
    generationStatus: string;
    generationProgress: number;
    generationEvents?: Array<{ title: string; detail?: string }>;
  }) => (
    <div data-testid="generation-progress">
      <span>{generationStatus}</span>
      <span>{generationProgress}</span>
      <span>{(generationEvents || []).map((event) => event.title).join("|")}</span>
      <span>
        {(generationEvents || [])
          .map((event) => event.detail || "")
          .join("|")}
      </span>
    </div>
  ),
  IncrementalProcessingModal: () => null,
  RegenerateSegmentsModal: () => null,
  ScriptPreviewModal: () => null,
  ScriptSentencesTable: () => null,
}));

jest.mock(
  "@/app/books/[id]/studio/script/page-container/components/PageStates",
  () => ({
    ScriptStudioLoadingState: () => <div>loading</div>,
    ScriptStudioErrorState: ({ message }: { message: string }) => (
      <div>{message}</div>
    ),
  })
);

jest.mock(
  "@/app/books/[id]/studio/script/page-container/hooks/useConfirmDialog",
  () => ({
    useConfirmDialog: () => ({
      confirmDialog: {
        open: false,
        title: "",
        description: "",
        confirmText: "确认",
        cancelText: "取消",
        destructive: false,
      },
      requestConfirmation: jest.fn().mockResolvedValue(true),
      resolveConfirmation: jest.fn(),
    }),
  })
);

jest.mock(
  "@/app/books/[id]/studio/script/page-container/hooks/useScriptStudioData",
  () => ({
    useScriptStudioData: () => ({
      book: { id: "book-1", title: "测试书籍" },
      segments: [mockSegment, mockSegmentWithoutFailure],
      characters: [],
      scriptSentences: [],
      loading: false,
      error: null,
      setScriptSentences: jest.fn(),
      loadBookAndData: jest.fn().mockResolvedValue(undefined),
      hasTextSegments: true,
      hasScriptSentences: false,
      sentencesBySegment: new Map(),
      chapterNodes: [
        {
          id: "chapter-1",
          title: "第一章",
          totalSegments: 2,
          scriptSegments: 0,
          audioSegments: 0,
          segments: [
            {
              id: "segment-1",
              label: "段落 #1",
              hasScript: false,
              hasAudio: false,
              preview: "这是当前段落的正文",
            },
            {
              id: "segment-2",
              label: "段落 #2",
              hasScript: false,
              hasAudio: false,
              preview: "这是没有失败记录的段落",
            },
          ],
        },
      ],
      chapterSegmentIds: new Map(),
      segmentMetaMap: new Map([
        ["segment-1", mockSegmentMeta],
        ["segment-2", mockSegmentWithoutFailureMeta],
      ]),
      latestFailedReviewTaskBySegment: new Map([
        [mockSegment.id, mockFailedReviewTaskLink],
      ]),
      bookStats: {
        totalChapters: 1,
        totalSegments: 2,
        scriptSegments: 0,
        audioSegments: 0,
      },
      getSelectedState: (
        node: { type: "book" | "chapter" | "segment"; id: string }
      ) =>
        node.type === "segment"
          ? {
              selectedChapterNode: null,
              selectedSegment: mockSegment,
              selectedSegmentSentences: [],
              selectedSegmentMeta: mockSegmentMeta,
            }
          : node.type === "chapter"
            ? {
                selectedChapterNode: {
                  id: "chapter-1",
                  title: "第一章",
                  totalSegments: 2,
                  scriptSegments: 0,
                  audioSegments: 0,
                  segments: [
                    {
                      id: "segment-1",
                      label: "段落 #1",
                      hasScript: false,
                      hasAudio: false,
                      preview: "这是当前段落的正文",
                    },
                    {
                      id: "segment-2",
                      label: "段落 #2",
                      hasScript: false,
                      hasAudio: false,
                      preview: "这是没有失败记录的段落",
                    },
                  ],
                },
                selectedSegment: null,
                selectedSegmentSentences: [],
                selectedSegmentMeta: null,
              }
          : {
              selectedChapterNode: null,
              selectedSegment: null,
              selectedSegmentSentences: [],
              selectedSegmentMeta: null,
            },
    }),
  })
);

jest.mock(
  "@/app/books/[id]/studio/script/page-container/hooks/actions/useScriptScopeActions",
  () => ({
    useScriptScopeActions: ({
      generateScript,
      handleSegmentRegeneration,
    }: {
      generateScript: () => Promise<void>;
      handleSegmentRegeneration: (
        segmentIds: string[],
        contextLabel?: string
      ) => Promise<void>;
    }) => ({
      handleScopeScriptGeneration: async (
        scope: "book" | "segment",
        targetId?: string
      ) => {
        if (scope === "book") {
          await generateScript();
        }
        if (scope === "segment" && targetId) {
          await handleSegmentRegeneration([targetId], "当前段落台本生成");
        }
      },
      handleScopeAudioGeneration: jest.fn(),
    }),
  })
);

jest.mock(
  "@/app/books/[id]/studio/script/page-container/hooks/actions/useScriptSentenceActions",
  () => ({
    useScriptSentenceActions: () => ({
      handleSentenceEdit: jest.fn(),
      handleSentenceDelete: jest.fn(),
      handleSentenceAudioGeneration: jest.fn(),
    }),
  })
);

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const queue = this.listeners.get(type) || [];
    queue.push(listener);
    this.listeners.set(type, queue);
  }

  emit(type: string, data: Record<string, unknown>) {
    const event = {
      data: JSON.stringify(data),
    } as MessageEvent;

    if (type === "message" && this.onmessage) {
      this.onmessage(event);
    }

    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }

  close() {}
}

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

describe("script studio model switching", () => {
  const originalFetch = global.fetch;
  const originalEventSource = global.EventSource;

  beforeEach(() => {
    MockEventSource.instances = [];
    global.EventSource = MockEventSource as any;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            defaultModelId: "deepseek-cloud",
            models: [
              {
                id: "deepseek-cloud",
                label: "DeepSeek Cloud",
                provider: "custom",
                model: "deepseek-chat",
                baseURL: "https://api.deepseek.com/v1",
              },
              {
                id: "qwen-local",
                label: "Qwen Local",
                provider: "custom",
                model: "Qwen3.5-9B-GGUF-Q4_K_M",
                baseURL: "http://192.168.88.9:8028/v1",
              },
            ],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            taskId: "script-task-1",
          },
        }),
      } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.EventSource = originalEventSource;
    document.body.innerHTML = "";
    setMockNodeParam(null);
    jest.clearAllMocks();
  });

  it("loads llm models and sends the selected llmModelId on full-book generation", async () => {
    const { container, root } = await mount(<ScriptStudioPageContainer />);

    await act(async () => {
      await Promise.resolve();
    });

    const select = container.querySelector(
      'select[aria-label="台本模型"]'
    ) as HTMLSelectElement | null;
    expect(select).not.toBeNull();

    await act(async () => {
      select!.value = "qwen-local";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const button = Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent === "全书台本生成"
    ) as HTMLButtonElement | undefined;
    expect(button).toBeDefined();

    await act(async () => {
      button!.click();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/llm/models");
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/books/book-1/script/generate",
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      })
    );

    const secondCall = (global.fetch as jest.Mock).mock.calls[1];
    const requestBody = JSON.parse(secondCall[1].body as string);

    expect(requestBody.options.llmModelId).toBe("qwen-local");

    await unmount(root, container);
  });

  it("renders runtime events pushed from the script generation stream", async () => {
    const { container, root } = await mount(<ScriptStudioPageContainer />);

    await act(async () => {
      await Promise.resolve();
    });

    const button = Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent === "全书台本生成"
    ) as HTMLButtonElement | undefined;
    expect(button).toBeDefined();

    await act(async () => {
      button!.click();
      await Promise.resolve();
    });

    const stream = MockEventSource.instances[0];
    expect(stream).toBeDefined();

    await act(async () => {
      stream.emit("runtime_event", {
        seq: 1,
        kind: "llm_completed",
        title: "LLM 调用完成",
        detail: "segment_scripting · custom/deepseek-chat · 120ms",
        status: "success",
        createdAt: "2026-03-22T10:00:30.000Z",
        progress: 46,
      });
      stream.emit("task_snapshot", {
        status: "processing",
        progress: 46,
        message: "第 1/1 段台本生成中",
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("第 1/1 段台本生成中");
    expect(container.textContent).toContain("46");
    expect(container.textContent).toContain("LLM 调用完成");
    expect(container.textContent).toContain(
      "segment_scripting · custom/deepseek-chat · 120ms"
    );

    await unmount(root, container);
  });

  it("triggers single-segment regeneration from the current segment entry", async () => {
    setMockNodeParam("segment:segment-1");
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            defaultModelId: "deepseek-cloud",
            models: [
              {
                id: "deepseek-cloud",
                label: "DeepSeek Cloud",
                provider: "custom",
                model: "deepseek-chat",
              },
            ],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            taskId: "script-task-segment-1",
          },
        }),
      } as Response);

    const { container, root } = await mount(<ScriptStudioPageContainer />);

    await act(async () => {
      await Promise.resolve();
    });

    const regenerateCurrentSegmentButton = Array.from(
      container.querySelectorAll("button")
    ).find((item) => item.textContent === "当前段落台本生成") as
      | HTMLButtonElement
      | undefined;

    expect(regenerateCurrentSegmentButton).toBeDefined();

    await act(async () => {
      regenerateCurrentSegmentButton!.click();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/llm/models");
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/books/book-1/script/generate",
      expect.objectContaining({
        method: "PATCH",
        body: expect.any(String),
      })
    );

    const secondCall = (global.fetch as jest.Mock).mock.calls[1];
    const requestBody = JSON.parse(secondCall[1].body as string);

    expect(requestBody.segmentIds).toEqual(["segment-1"]);
    expect(requestBody.options.llmModelId).toBe("deepseek-cloud");

    await unmount(root, container);
  });

  it("renders review failure links for chapter rows and current segment header", async () => {
    setMockNodeParam("chapter:chapter-1");
    const { container, root } = await mount(<ScriptStudioPageContainer />);

    await act(async () => {
      await Promise.resolve();
    });

    const chapterFailureLinks = Array.from(container.querySelectorAll("a")).filter(
      (item) => item.textContent === "查看质检失败"
    );
    expect(chapterFailureLinks).toHaveLength(1);
    expect(chapterFailureLinks[0].getAttribute("href")).toBe(
      "/books/book-1/review#task-task-failed-1"
    );

    setMockNodeParam("segment:segment-1");
    await act(async () => {
      root.render(<ScriptStudioPageContainer />);
      await Promise.resolve();
    });

    const segmentHeaderFailureLink = Array.from(container.querySelectorAll("a")).find(
      (item) => item.textContent === "查看质检失败"
    );
    expect(segmentHeaderFailureLink).toBeDefined();
    expect(segmentHeaderFailureLink?.getAttribute("href")).toBe(
      "/books/book-1/review#task-task-failed-1"
    );

    await unmount(root, container);
  });
});

describe("buildSegmentFailedReviewTaskLinks", () => {
  it("prefers metadata.segmentIds when mapping the latest failed task to a segment", () => {
    const links = buildSegmentFailedReviewTaskLinks({
      bookId: "book-1",
      tasks: [
        {
          id: "task-1",
          taskType: "SCRIPT_GENERATION",
          status: "failed",
          createdAt: "2026-04-15T06:40:00.000Z",
          updatedAt: "2026-04-15T06:42:45.000Z",
          metadata: {
            segmentIds: ["segment-from-segment-ids"],
            failedSegmentDetails: [
              {
                segmentId: "segment-from-details",
              },
            ],
            failedSegmentIds: ["segment-from-failed-ids"],
          },
        },
      ],
    });

    expect(links.get("segment-from-segment-ids")).toEqual({
      taskId: "task-1",
      reviewUrl: "/books/book-1/review#task-task-1",
      updatedAt: "2026-04-15T06:42:45.000Z",
    });
    expect(links.has("segment-from-details")).toBe(false);
    expect(links.has("segment-from-failed-ids")).toBe(false);
  });

  it("uses failed segment details for multi-segment failures to avoid tagging successful segments", () => {
    const links = buildSegmentFailedReviewTaskLinks({
      bookId: "book-1",
      tasks: [
        {
          id: "task-batch-failure",
          taskType: "SCRIPT_GENERATION",
          status: "failed",
          createdAt: "2026-04-15T06:40:00.000Z",
          updatedAt: "2026-04-15T06:42:45.000Z",
          metadata: {
            segmentIds: ["segment-success", "segment-failed"],
            failedSegmentDetails: [
              {
                segmentId: "segment-failed",
              },
            ],
            failedSegmentIds: ["segment-failed"],
          },
        },
      ],
    });

    expect(links.has("segment-success")).toBe(false);
    expect(links.get("segment-failed")).toEqual({
      taskId: "task-batch-failure",
      reviewUrl: "/books/book-1/review#task-task-batch-failure",
      updatedAt: "2026-04-15T06:42:45.000Z",
    });
  });

  it("keeps the latest failed task when multiple failures target the same segment", () => {
    const links = buildSegmentFailedReviewTaskLinks({
      bookId: "book-1",
      tasks: [
        {
          id: "task-older",
          taskType: "SCRIPT_GENERATION",
          status: "failed",
          createdAt: "2026-04-15T06:00:00.000Z",
          updatedAt: "2026-04-15T06:10:00.000Z",
          metadata: {
            segmentIds: ["segment-1"],
          },
        },
        {
          id: "task-latest",
          taskType: "SCRIPT_GENERATION",
          status: "failed",
          createdAt: "2026-04-15T07:00:00.000Z",
          updatedAt: "2026-04-15T07:10:00.000Z",
          metadata: {
            segmentIds: ["segment-1"],
          },
        },
        {
          id: "task-non-failed",
          taskType: "SCRIPT_GENERATION",
          status: "completed",
          createdAt: "2026-04-15T08:00:00.000Z",
          updatedAt: "2026-04-15T08:10:00.000Z",
          metadata: {
            segmentIds: ["segment-1"],
          },
        },
      ],
    });

    expect(links.get("segment-1")).toEqual({
      taskId: "task-latest",
      reviewUrl: "/books/book-1/review#task-task-latest",
      updatedAt: "2026-04-15T07:10:00.000Z",
    });
  });
});
