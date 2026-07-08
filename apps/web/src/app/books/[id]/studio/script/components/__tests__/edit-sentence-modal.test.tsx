import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { EditSentenceModal } from "../EditSentenceModal";

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

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

jest.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
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

describe("edit sentence modal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("shows a dedicated prosody section and submits existing advanced values", async () => {
    const onSave = jest.fn();
    const { container, root } = await mount(
      <EditSentenceModal
        sentence={{
          id: "sentence-1",
          text: "别怕。",
          orderInSegment: 0,
          segmentId: "segment-1",
          characterId: "char-1",
          tone: "沉稳",
          strength: 52,
          pauseAfter: 1,
          prosody: {
            pace: 0.91,
            pitch: -0.1,
            energy: 0.42,
            pauseMsAfter: 1000,
          },
          character: {
            id: "char-1",
            canonicalName: "燕赤霞",
          },
        }}
        characters={[
          {
            id: "char-1",
            canonicalName: "燕赤霞",
            isActive: true,
          },
        ]}
        onClose={() => undefined}
        onSave={onSave}
      />
    );

    expect(container.textContent).toContain("朗读参数");
    const inputs = Array.from(container.querySelectorAll("input"));
    const toneInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "例如：平静、激动、严肃"
    );
    const strengthInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "0-100"
    );
    const pauseAfterInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "例如：1.5"
    );
    const paceInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "例如：0.95"
    );
    const pitchInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "例如：-0.10"
    );
    const energyInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "例如：0.42"
    );
    const pauseMsAfterInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "例如：1000"
    );
    const textArea = container.querySelector("textarea") as HTMLTextAreaElement | null;
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("保存")
    );

    expect(toneInput?.value).toBe("沉稳");
    expect(strengthInput?.value).toBe("52");
    expect(pauseAfterInput?.value).toBe("1");
    expect(paceInput?.value).toBe("0.91");
    expect(pitchInput?.value).toBe("-0.1");
    expect(energyInput?.value).toBe("0.42");
    expect(pauseMsAfterInput?.value).toBe("1000");

    expect(textArea?.value).toBe("别怕。");

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledWith(
      "sentence-1",
      expect.objectContaining({
        text: "别怕。",
        tone: "沉稳",
        strength: 52,
        pauseAfter: 1,
        prosody: {
          pace: 0.91,
          pitch: -0.1,
          energy: 0.42,
          pauseMsAfter: 1000,
        },
      })
    );

    await unmount(root, container);
  });
});
