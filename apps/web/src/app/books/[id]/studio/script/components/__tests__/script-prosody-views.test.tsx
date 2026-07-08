import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ScriptPreviewModal } from "../ScriptPreviewModal";
import { ScriptSentenceCard } from "../ScriptSentenceCard";
import { ScriptSentencesTable } from "../ScriptSentencesTable";

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

jest.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) => (
    <td colSpan={colSpan}>{children}</td>
  ),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const sampleSentence = {
  id: "sentence-1",
  text: "别怕，我在。",
  segmentId: "segment-1",
  orderInSegment: 0,
  tone: "沉稳",
  strength: 64,
  pauseAfter: 1.2,
  prosody: {
    pace: 0.91,
    pitch: -0.2,
    energy: 0.42,
    pauseMsAfter: 1000,
  },
  character: {
    id: "char-1",
    canonicalName: "燕赤霞",
  },
  audioFiles: [],
};

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

describe("script prosody views", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("renders the shared spec strip in card, table and preview views", async () => {
    const { container, root } = await mount(
      <div>
        <ScriptSentenceCard
          sentence={sampleSentence as any}
          index={0}
          bookId="book-1"
          onEdit={() => undefined}
          onDelete={() => undefined}
          onAudioGenerated={() => undefined}
        />
        <ScriptSentencesTable
          segmentTitle="第一段"
          sentences={[sampleSentence as any]}
        />
        <ScriptPreviewModal
          scriptSentences={[sampleSentence as any]}
          onClose={() => undefined}
        />
      </div>
    );

    const text = container.textContent || "";
    expect(text).toContain("沉稳");
    expect(text).toContain("强度64");
    expect(text).toContain("停顿1.2s");
    expect(text).toContain("语速0.91");
    expect(text).toContain("音高-0.20");
    expect(text).toContain("能量0.42");
    expect(text).toContain("尾停1000ms");

    await unmount(root, container);
  });
});
