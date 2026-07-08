// 一旦我被更新，请更新我的开头注释
// input: 书籍标识/节点信息
// output: 工作台深链接解析与构造
// pos: 页面容器工具
import type { ScriptNavigationNode } from "../components";

const BOOK_NODE_VALUE = "book";

export const parseScriptStudioNodeQuery = (
  bookId: string,
  value: string | null
): ScriptNavigationNode => {
  if (!value || value === BOOK_NODE_VALUE) {
    return { type: "book", id: bookId };
  }

  const [type, ...rest] = value.split(":");
  const id = rest.join(":").trim();

  if ((type === "chapter" || type === "segment") && id) {
    return { type, id } as ScriptNavigationNode;
  }

  return { type: "book", id: bookId };
};

export const formatScriptStudioNodeQuery = (
  node: ScriptNavigationNode
): string => {
  if (node.type === "book") {
    return BOOK_NODE_VALUE;
  }

  return `${node.type}:${node.id}`;
};

export const buildScriptStudioHref = (
  bookId: string,
  node?: ScriptNavigationNode
): string => {
  const nextNode = node ?? { type: "book", id: bookId };
  const nodeValue = formatScriptStudioNodeQuery(nextNode);

  if (nodeValue === BOOK_NODE_VALUE) {
    return `/books/${bookId}/studio/script`;
  }

  return `/books/${bookId}/studio/script?node=${encodeURIComponent(nodeValue)}`;
};

export const isSameScriptStudioNode = (
  left: ScriptNavigationNode,
  right: ScriptNavigationNode
): boolean => left.type === right.type && left.id === right.id;

