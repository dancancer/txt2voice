import type { RuntimeToolContract } from "./contracts";

export const LOAD_BOOK_CONTEXT_TOOL: RuntimeToolContract = {
  name: "load-book-context",
  kind: "io",
  sideEffect: false,
  inputSchemaRef: "tool.load-book-context.input.v1",
  outputSchemaRef: "tool.load-book-context.output.v1",
};

export const LOAD_SEGMENT_BATCH_TOOL: RuntimeToolContract = {
  name: "load-segment-batch",
  kind: "io",
  sideEffect: false,
  inputSchemaRef: "tool.load-segment-batch.input.v1",
  outputSchemaRef: "tool.load-segment-batch.output.v1",
};

export const LOAD_CHARACTER_MEMORY_TOOL: RuntimeToolContract = {
  name: "load-character-memory",
  kind: "io",
  sideEffect: false,
  inputSchemaRef: "tool.load-character-memory.input.v1",
  outputSchemaRef: "tool.load-character-memory.output.v1",
};

export const SAVE_CHARACTER_MEMORY_TOOL: RuntimeToolContract = {
  name: "save-character-memory",
  kind: "io",
  sideEffect: true,
  inputSchemaRef: "tool.save-character-memory.input.v1",
  outputSchemaRef: "tool.save-character-memory.output.v1",
};

export const SAVE_SCRIPT_DRAFT_TOOL: RuntimeToolContract = {
  name: "save-script-draft",
  kind: "io",
  sideEffect: true,
  inputSchemaRef: "tool.save-script-draft.input.v1",
  outputSchemaRef: "tool.save-script-draft.output.v1",
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

export interface LoadSegmentBatchInput {
  bookId: string;
  segmentIds?: string[];
}

export interface LoadCharacterMemoryInput {
  bookId: string;
}

export interface SaveCharacterMemoryInput {
  bookId: string;
  characterCount: number;
}

export interface SaveScriptDraftInput {
  bookId: string;
  segmentId: string;
  lineCount: number;
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

export const loadSegmentBatch = (input: LoadSegmentBatchInput) => {
  return {
    bookId: input.bookId,
    segmentIds: input.segmentIds || [],
  };
};

export const loadCharacterMemory = (input: LoadCharacterMemoryInput) => {
  return {
    bookId: input.bookId,
    canonicalIdentityCount: 0,
  };
};

export const saveCharacterMemory = (input: SaveCharacterMemoryInput) => {
  return {
    saved: true,
    bookId: input.bookId,
    characterCount: input.characterCount,
  };
};

export const saveScriptDraft = (input: SaveScriptDraftInput) => {
  return {
    saved: true,
    bookId: input.bookId,
    segmentId: input.segmentId,
    lineCount: input.lineCount,
  };
};

export const commitScriptSentences = (input: CommitScriptSentencesInput) => {
  return {
    committed: true,
    bookId: input.bookId,
    sentenceCount: input.sentenceCount,
  };
};
