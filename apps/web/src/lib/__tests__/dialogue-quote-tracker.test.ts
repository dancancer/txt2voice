import {
  buildInsideDialogueQuoteMap,
  updateDialogueQuoteStack,
} from "../dialogue-quote-tracker";

describe("dialogue quote tracker", () => {
  it("should ignore ASCII apostrophes inside English words", () => {
    const text = "I'm here. It's done. We'll leave when John's ready.";
    const insideQuote = buildInsideDialogueQuoteMap(text);

    expect(insideQuote.some(Boolean)).toBe(false);
  });

  it("should enter and exit Chinese dialogue quotes only around spoken content", () => {
    const text = "“你好。”她说。";
    const insideQuote = buildInsideDialogueQuoteMap(text);

    expect(insideQuote[text.indexOf("你")]).toBe(true);
    expect(insideQuote[text.indexOf("。")]).toBe(true);
    expect(insideQuote[text.indexOf("她")]).toBe(false);
  });

  it("should toggle the stack for symmetric ASCII double quotes", () => {
    const quoteStack: string[] = [];

    updateDialogueQuoteStack(quoteStack, '"');
    expect(quoteStack).toEqual(['"']);

    updateDialogueQuoteStack(quoteStack, '"');
    expect(quoteStack).toEqual([]);
  });

  it("should treat repeated Chinese opening quote as malformed closing quote when already inside dialogue", () => {
    const quoteStack: string[] = [];

    updateDialogueQuoteStack(quoteStack, "“");
    expect(quoteStack).toEqual(["”"]);

    updateDialogueQuoteStack(quoteStack, "“");
    expect(quoteStack).toEqual([]);
  });

  it("should stop marking narration as inside quote after malformed Chinese closing quote", () => {
    const text = "“我，我没事……“ 大块头说道。";
    const insideQuote = buildInsideDialogueQuoteMap(text);

    expect(insideQuote[text.indexOf("我")]).toBe(true);
    expect(insideQuote[text.indexOf("大")]).toBe(false);
  });
});
