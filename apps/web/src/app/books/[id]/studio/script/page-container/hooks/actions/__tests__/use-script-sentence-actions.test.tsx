import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useScriptSentenceActions } from "../useScriptSentenceActions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const updateScriptSentences = jest.fn();
const toastError = jest.fn();

jest.mock("@/lib/book-api", () => ({
  updateScriptSentences: (...args: unknown[]) => updateScriptSentences(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: jest.fn(),
  },
}));

type HookApi = ReturnType<typeof useScriptSentenceActions>;

const renderHook = async (params: Parameters<typeof useScriptSentenceActions>[0]) => {
  const apiRef = { current: null as HookApi | null };

  function TestComponent() {
    const api = useScriptSentenceActions(params);
    React.useEffect(() => {
      apiRef.current = api;
    }, [api]);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<TestComponent />);
  });

  return {
    getApi: () => {
      if (!apiRef.current) {
        throw new Error("hook api unavailable");
      }
      return apiRef.current;
    },
    root,
    container,
  };
};

const unmount = async (root: Root, container: HTMLElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe("useScriptSentenceActions", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("persists prosody edits through api payload and local state", async () => {
    updateScriptSentences.mockResolvedValue({
      success: true,
      data: [],
    });

    const setScriptSentences = jest.fn((updater) => {
      if (typeof updater === "function") {
        return updater([
          {
            id: "sentence-1",
            text: "别怕。",
            segmentId: "segment-1",
            orderInSegment: 0,
            characterId: "char-1",
            character: { id: "char-1", canonicalName: "燕赤霞" },
          },
        ]);
      }
      return updater;
    });
    const setEditingSentence = jest.fn();

    const { getApi, root, container } = await renderHook({
      bookId: "book-1",
      characters: [
        {
          id: "char-1",
          canonicalName: "燕赤霞",
          isActive: true,
        },
      ] as any,
      scriptSentences: [],
      setScriptSentences,
      setEditingSentence,
      requestConfirmation: jest.fn(),
    });

    await act(async () => {
      await getApi().handleSentenceEdit("sentence-1", {
        text: "别怕，我在。",
        tone: "沉稳",
        characterId: "char-1",
        strength: 64,
        pauseAfter: 1.2,
        prosody: {
          pace: 0.91,
          pitch: -0.2,
          energy: 0.42,
          pauseMsAfter: 1000,
        },
      });
    });

    expect(updateScriptSentences).toHaveBeenCalledWith("book-1", [
      {
        id: "sentence-1",
        text: "别怕，我在。",
        tone: "沉稳",
        characterId: "char-1",
        rawSpeaker: undefined,
        roleType: undefined,
        strength: 64,
        pauseAfter: 1.2,
        prosody: {
          pace: 0.91,
          pitch: -0.2,
          energy: 0.42,
          pauseMsAfter: 1000,
        },
      },
    ]);

    expect(setScriptSentences).toHaveBeenCalled();
    const updater = setScriptSentences.mock.calls[0]?.[0] as
      | ((value: any[]) => any[])
      | undefined;
    const nextState = updater?.([
      {
        id: "sentence-1",
        text: "别怕。",
        segmentId: "segment-1",
        orderInSegment: 0,
        characterId: "char-1",
        character: { id: "char-1", canonicalName: "燕赤霞" },
      },
    ]);

    expect(nextState?.[0]).toEqual(
      expect.objectContaining({
        text: "别怕，我在。",
        tone: "沉稳",
        strength: 64,
        pauseAfter: 1.2,
        prosody: {
          pace: 0.91,
          pitch: -0.2,
          energy: 0.42,
          pauseMsAfter: 1000,
        },
      })
    );
    expect(setEditingSentence).toHaveBeenCalledWith(null);

    await unmount(root, container);
  });
});
