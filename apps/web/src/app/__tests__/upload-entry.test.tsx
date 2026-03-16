import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Home from "../page";
import { Header } from "@/components/Navigation";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockUsePathname = jest.fn();
const mockUseRouter = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/BookList", () => ({
  BookList: () => <div data-testid="book-list">book-list</div>,
}));

jest.mock("@/components/BookUpload", () => ({
  BookUpload: () => <div data-testid="book-upload">book-upload</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, props);
    }

    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => {
  const React = require("react");
  const OpenContext = React.createContext(false);

  return {
    Dialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => <OpenContext.Provider value={open}>{children}</OpenContext.Provider>,
    DialogContent: ({ children }: { children: React.ReactNode }) => {
      const open = React.useContext(OpenContext);
      return open ? <div data-testid="dialog-content">{children}</div> : null;
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

const mount = async (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return {
    container,
    root,
  };
};

const unmount = async (root: Root, container: HTMLElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe("upload entry", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    mockUseRouter.mockReturnValue({
      replace: jest.fn(),
    });
    mockUseSearchParams.mockReturnValue({
      get: jest.fn(() => null),
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("should render a global upload entry in header", async () => {
    const { container, root } = await mount(<Header />);

    const uploadLink = container.querySelector('a[href="/?create=1"]');
    expect(uploadLink).not.toBeNull();
    expect(uploadLink?.textContent).toContain("上传书籍");

    await unmount(root, container);
  });

  it("should open upload dialog when create query is present", async () => {
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => (key === "create" ? "1" : null)),
    });

    const { container, root } = await mount(<Home />);

    expect(container.textContent).toContain("创建新书籍");
    expect(container.querySelector('[data-testid="dialog-content"]')).not.toBeNull();

    await unmount(root, container);
  });
});
