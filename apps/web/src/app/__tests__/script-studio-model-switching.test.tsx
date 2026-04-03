import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ScriptStudioPageContainer } from "@/app/books/[id]/studio/script/page-container";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "book-1" }),
  useRouter: () => ({ back: jest.fn() }),
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

jest.mock("@/app/books/[id]/studio/script/components", () => ({
  DocumentTree: () => <div>DocumentTree</div>,
  ChapterSegmentsTable: () => <div>ChapterSegmentsTable</div>,
  EditSentenceModal: () => null,
  GenerationProgress: () => null,
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
      segments: [{ id: "segment-1" }],
      characters: [],
      scriptSentences: [],
      loading: false,
      error: null,
      setScriptSentences: jest.fn(),
      loadBookAndData: jest.fn().mockResolvedValue(undefined),
      hasTextSegments: true,
      hasScriptSentences: false,
      sentencesBySegment: new Map(),
      chapterNodes: [],
      chapterSegmentIds: new Map(),
      segmentMetaMap: new Map(),
      bookStats: {},
      getSelectedState: () => ({
        selectedChapterNode: null,
        selectedSegment: null,
        selectedSegmentSentences: [],
        selectedSegmentMeta: null,
      }),
    }),
  })
);

jest.mock(
  "@/app/books/[id]/studio/script/page-container/hooks/actions/useScriptScopeActions",
  () => ({
    useScriptScopeActions: ({
      generateScript,
    }: {
      generateScript: () => Promise<void>;
    }) => ({
      handleScopeScriptGeneration: async (scope: "book") => {
        if (scope === "book") {
          await generateScript();
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
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener() {}

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
});
