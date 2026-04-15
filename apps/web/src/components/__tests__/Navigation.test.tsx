import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Navigation } from "@/components/Navigation";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <span className={className} />;

  return {
    BookOpen: Icon,
    Blocks: Icon,
    Menu: Icon,
    Mic: Icon,
    ListTodo: Icon,
    Sparkles: Icon,
    Plus: Icon,
    Settings2: Icon,
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

describe("Navigation", () => {
  it("renders an llm settings entry in the top global navigation", async () => {
    const { container, root } = await mount(<Navigation />);

    const links = Array.from(container.querySelectorAll("a"));
    const llmSettingsLink = links.find(
      (link) => link.textContent?.trim() === "LLM 设置"
    );

    expect(llmSettingsLink).toBeDefined();
    expect(llmSettingsLink?.getAttribute("href")).toBe("/settings/llm");

    await unmount(root, container);
  });
});
