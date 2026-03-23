import type { RuntimeToolContract } from "./contracts";

export const LOAD_BOOK_CONTEXT_TOOL: RuntimeToolContract = {
  name: "load-book-context",
  kind: "io",
  sideEffect: false,
  inputSchemaRef: "tool.load-book-context.input.v1",
  outputSchemaRef: "tool.load-book-context.output.v1",
};

export const SAVE_CHARACTER_MEMORY_TOOL: RuntimeToolContract = {
  name: "save-character-memory",
  kind: "io",
  sideEffect: true,
  inputSchemaRef: "tool.save-character-memory.input.v1",
  outputSchemaRef: "tool.save-character-memory.output.v1",
};

export const COMMIT_SCRIPT_SENTENCES_TOOL: RuntimeToolContract = {
  name: "commit-script-sentences",
  kind: "io",
  sideEffect: true,
  inputSchemaRef: "tool.commit-script-sentences.input.v1",
  outputSchemaRef: "tool.commit-script-sentences.output.v1",
};

export interface LoadBookContextInput {
  bookId: string;
  excerpt?: string;
}

export interface SaveCharacterMemoryInput {
  bookId: string;
  characterCount: number;
}

export interface CommitScriptSentencesInput {
  bookId: string;
  sentenceCount: number;
}

export const loadBookContext = (input: LoadBookContextInput) => {
  return {
    bookId: input.bookId,
    excerpt: input.excerpt || "",
  };
};

export const saveCharacterMemory = (input: SaveCharacterMemoryInput) => {
  return {
    saved: true,
    bookId: input.bookId,
    characterCount: input.characterCount,
  };
};

export const commitScriptSentences = (input: CommitScriptSentencesInput) => {
  return {
    committed: true,
    bookId: input.bookId,
    sentenceCount: input.sentenceCount,
  };
};
