import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ScriptProsodyDisplay } from "../prosody-display";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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

describe("script prosody display", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders prosody items in a stable control-console order", async () => {
    const { container, root } = await mount(
      <ScriptProsodyDisplay
        strength={52}
        pauseAfter={1}
        prosody={{
          pace: 0.91,
          pitch: -0.1,
          energy: 0.42,
          pauseMsAfter: 1000,
        }}
      />
    );

    const text = container.textContent || "";
    expect(text).toContain("强度52");
    expect(text).toContain("停顿1.0s");
    expect(text).toContain("语速0.91");
    expect(text).toContain("音高-0.10");
    expect(text).toContain("能量0.42");
    expect(text).toContain("尾停1000ms");
    expect(text.indexOf("强度")).toBeLessThan(text.indexOf("停顿"));
    expect(text.indexOf("停顿")).toBeLessThan(text.indexOf("语速"));
    expect(text.indexOf("语速")).toBeLessThan(text.indexOf("音高"));

    await unmount(root, container);
  });

  it("omits empty fields instead of rendering placeholders", async () => {
    const { container, root } = await mount(
      <ScriptProsodyDisplay prosody={{ pitch: 0.22 }} />
    );

    const text = container.textContent || "";
    expect(text).toContain("音高+0.22");
    expect(text).not.toContain("强度");
    expect(text).not.toContain("停顿");
    expect(text).not.toContain("语速");

    await unmount(root, container);
  });
});

