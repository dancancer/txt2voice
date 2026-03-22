export const DIALOGUE_QUOTE_PAIRS: Array<{ open: string; close: string }> = [
  { open: "“", close: "”" },
  { open: '"', close: '"' },
  { open: "「", close: "」" },
  { open: "『", close: "』" },
  { open: "‘", close: "’" },
];

export const DIALOGUE_CLOSING_QUOTE_CHARS = new Set(
  Array.from(new Set(DIALOGUE_QUOTE_PAIRS.map((pair) => pair.close)))
);

const OPEN_TO_CLOSE = new Map(
  DIALOGUE_QUOTE_PAIRS.map((pair) => [pair.open, pair.close])
);

export const updateDialogueQuoteStack = (
  quoteStack: string[],
  char: string
) => {
  const matchingClose = OPEN_TO_CLOSE.get(char);
  if (matchingClose) {
    if (matchingClose === char) {
      if (quoteStack[quoteStack.length - 1] === char) {
        quoteStack.pop();
      } else {
        quoteStack.push(char);
      }
      return;
    }

    if (quoteStack[quoteStack.length - 1] === matchingClose) {
      quoteStack.pop();
      return;
    }

    quoteStack.push(matchingClose);
    return;
  }

  if (quoteStack[quoteStack.length - 1] === char) {
    quoteStack.pop();
  }
};

export const buildInsideDialogueQuoteMap = (text: string): boolean[] => {
  const insideQuote = new Array(text.length).fill(false);
  const quoteStack: string[] = [];

  for (let index = 0; index < text.length; index += 1) {
    insideQuote[index] = quoteStack.length > 0;
    updateDialogueQuoteStack(quoteStack, text[index]);
  }

  return insideQuote;
};
