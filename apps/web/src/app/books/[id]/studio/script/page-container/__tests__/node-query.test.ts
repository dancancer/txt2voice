import {
  buildScriptStudioHref,
  formatScriptStudioNodeQuery,
  isSameScriptStudioNode,
  parseScriptStudioNodeQuery,
} from "../node-query";

describe("script studio node query helpers", () => {
  it("falls back to the book node when query is empty or invalid", () => {
    expect(parseScriptStudioNodeQuery("book-1", null)).toEqual({
      type: "book",
      id: "book-1",
    });
    expect(parseScriptStudioNodeQuery("book-1", "weird")).toEqual({
      type: "book",
      id: "book-1",
    });
  });

  it("parses chapter and segment nodes from query values", () => {
    expect(parseScriptStudioNodeQuery("book-1", "chapter:chapter-7")).toEqual({
      type: "chapter",
      id: "chapter-7",
    });
    expect(parseScriptStudioNodeQuery("book-1", "segment:segment-3")).toEqual({
      type: "segment",
      id: "segment-3",
    });
  });

  it("formats and builds deep links consistently", () => {
    expect(
      formatScriptStudioNodeQuery({ type: "chapter", id: "chapter-7" })
    ).toBe("chapter:chapter-7");
    expect(buildScriptStudioHref("book-1")).toBe("/books/book-1/studio/script");
    expect(
      buildScriptStudioHref("book-1", { type: "segment", id: "segment-3" })
    ).toBe("/books/book-1/studio/script?node=segment%3Asegment-3");
  });

  it("compares nodes by type and id", () => {
    expect(
      isSameScriptStudioNode(
        { type: "book", id: "book-1" },
        { type: "book", id: "book-1" }
      )
    ).toBe(true);
    expect(
      isSameScriptStudioNode(
        { type: "book", id: "book-1" },
        { type: "chapter", id: "chapter-1" }
      )
    ).toBe(false);
  });
});

