import type { CharacterMemory, SegmentScriptDraft } from "../context";
import {
  createPersistTools,
  type PersistCharacterMemoryDraftInput,
  type PersistSegmentScriptDraftInput,
} from "../tools/persist-tools";
import {
  runPersistStage,
  type RunPersistStageResult,
} from "../runtime/stages/run-persist-stage";

const asCompletedResult = (
  result: RunPersistStageResult
): Extract<RunPersistStageResult, { status: "completed" }> => {
  if (result.status !== "completed") {
    throw new Error(`Expected completed status, received ${result.status}`);
  }

  return result;
};

const createRuntimeDeps = () => {
  let nextId = 0;

  return {
    createId: () => `runtime-${nextId++}`,
    appendTrace: async () => undefined,
    createStageRun: async () => undefined,
    updateStageRun: async () => undefined,
  };
};

const buildCharacterMemory = (): CharacterMemory => ({
  canonicalIdentities: [
    {
      id: "char-ning",
      name: "宁采臣",
    },
  ],
  aliasEvidence: [
    {
      alias: "宁书生",
      canonicalId: "char-ning",
      source: "segment-1",
    },
  ],
  assertedFacts: {
    "char-ning": {
      importance: "main",
      dialogueStyle: "文雅",
    },
  },
  inferredHints: {},
});

const buildSegmentScriptDraft = (): SegmentScriptDraft => ({
  segmentId: "segment-1",
  createdAt: "2026-03-24T00:00:00.000Z",
  lines: [
    {
      id: "line-1",
      sourceText: "宁采臣拱手。",
      text: "在下宁采臣。",
      speaker: "宁采臣",
      orderInSegment: 0,
    },
  ],
});

describe("persist stage", () => {
  it("commits CharacterMemory artifact through controlled persistence tool", async () => {
    const upsertCalls: PersistCharacterMemoryDraftInput[] = [];
    const tools = createPersistTools({
      upsertCharacterCandidates: async (input) => {
        upsertCalls.push(input);
      },
      saveSegmentScriptToDatabase: async () => {
        throw new Error("unexpected saveSegmentScriptToDatabase invocation");
      },
    });

    const result = await runPersistStage({
      workflowRunId: "wf-persist-character",
      bookId: "book-1",
      artifacts: [
        {
          kind: "character-memory-draft",
          characterMemory: buildCharacterMemory(),
        },
      ],
      tools,
      ...createRuntimeDeps(),
    });

    const completed = asCompletedResult(result);
    expect(completed.artifact.persistedCharacterCount).toBe(1);
    expect(completed.artifact.persistedSentenceCount).toBe(0);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]?.candidates).toEqual([
      expect.objectContaining({
        name: "宁采臣",
        aliases: ["宁书生"],
        importance: "main",
        dialogueStyle: "文雅",
      }),
    ]);
  });

  it("commits SegmentScriptDraft artifact into ScriptSentence persistence path", async () => {
    const sentenceCalls: PersistSegmentScriptDraftInput[] = [];
    const tools = createPersistTools({
      upsertCharacterCandidates: async () => {
        throw new Error("unexpected upsertCharacterCandidates invocation");
      },
      saveSegmentScriptToDatabase: async (input) => {
        sentenceCalls.push(input);
      },
    });

    const result = await runPersistStage({
      workflowRunId: "wf-persist-segment",
      bookId: "book-1",
      artifacts: [
        {
          kind: "segment-script-draft",
          segmentScriptDraft: buildSegmentScriptDraft(),
        },
      ],
      tools,
      ...createRuntimeDeps(),
    });

    const completed = asCompletedResult(result);
    expect(completed.artifact.persistedCharacterCount).toBe(0);
    expect(completed.artifact.persistedSentenceCount).toBe(1);
    expect(sentenceCalls).toHaveLength(1);
    expect(sentenceCalls[0]?.dialogueLines).toEqual([
      expect.objectContaining({
        id: "line-1",
        segmentId: "segment-1",
        characterName: "宁采臣",
        rawSpeaker: "宁采臣",
        text: "在下宁采臣。",
        orderInSegment: 0,
      }),
    ]);
  });

  it("keeps persistence idempotent when replaying same artifacts", async () => {
    const characterStore = new Map<string, { aliases: Set<string> }>();
    const sentenceStore = new Map<
      string,
      Array<{ id: string; text: string; speaker: string; orderInSegment: number }>
    >();
    let saveCalls = 0;
    const tools = createPersistTools({
      upsertCharacterCandidates: async (input) => {
        for (const candidate of input.candidates) {
          const existing = characterStore.get(candidate.name) ?? {
            aliases: new Set<string>(),
          };
          for (const alias of candidate.aliases) {
            existing.aliases.add(alias);
          }
          characterStore.set(candidate.name, existing);
        }
      },
      saveSegmentScriptToDatabase: async (input) => {
        saveCalls += 1;
        sentenceStore.set(
          input.segmentId,
          input.dialogueLines.map((line) => ({
            id: line.id,
            text: line.text,
            speaker: line.rawSpeaker || "",
            orderInSegment: line.orderInSegment,
          }))
        );
      },
    });
    const artifacts = [
      {
        kind: "character-memory-draft" as const,
        characterMemory: buildCharacterMemory(),
      },
      {
        kind: "segment-script-draft" as const,
        segmentScriptDraft: buildSegmentScriptDraft(),
      },
    ];
    const runtimeDeps = createRuntimeDeps();

    const first = await runPersistStage({
      workflowRunId: "wf-persist-idempotent",
      bookId: "book-1",
      artifacts,
      tools,
      ...runtimeDeps,
    });
    const firstSnapshot = {
      characterCount: characterStore.size,
      aliases: [...(characterStore.get("宁采臣")?.aliases || new Set<string>())],
      sentenceCount: sentenceStore.get("segment-1")?.length ?? 0,
    };

    const second = await runPersistStage({
      workflowRunId: "wf-persist-idempotent",
      bookId: "book-1",
      artifacts,
      tools,
      ...runtimeDeps,
    });
    const secondSnapshot = {
      characterCount: characterStore.size,
      aliases: [...(characterStore.get("宁采臣")?.aliases || new Set<string>())],
      sentenceCount: sentenceStore.get("segment-1")?.length ?? 0,
    };

    const firstCompleted = asCompletedResult(first);
    const secondCompleted = asCompletedResult(second);
    expect(firstCompleted.artifact).toEqual(secondCompleted.artifact);
    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(secondSnapshot).toEqual({
      characterCount: 1,
      aliases: ["宁书生"],
      sentenceCount: 1,
    });
    expect(saveCalls).toBe(2);
  });
});
