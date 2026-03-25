import type { CharacterMemory, SegmentScriptDraft } from "../context";
import type { AgentRunRecord, ToolCallRecord } from "../runtime/run-agent";
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
  const agentRuns: Array<
    AgentRunRecord & {
      completedAt?: Date;
    }
  > = [];
  const toolCalls: Array<
    ToolCallRecord & {
      createdAt?: Date;
      completedAt?: Date;
    }
  > = [];

  return {
    createId: () => `runtime-${nextId++}`,
    appendTrace: async () => undefined,
    createStageRun: async () => undefined,
    updateStageRun: async () => undefined,
    createAgentRun: async (
      record: AgentRunRecord & { completedAt?: Date }
    ) => {
      agentRuns.push(record);
    },
    updateAgentRun: async (
      record: AgentRunRecord & { completedAt?: Date }
    ) => {
      const target = agentRuns.find((item) => item.id === record.id);
      if (target) {
        Object.assign(target, record);
      }
    },
    createToolCall: async (
      record: ToolCallRecord & { createdAt?: Date }
    ) => {
      toolCalls.push(record);
    },
    updateToolCall: async (
      record: ToolCallRecord & { completedAt?: Date }
    ) => {
      const target = toolCalls.find((item) => item.id === record.id);
      if (target) {
        Object.assign(target, record);
      }
    },
    agentRuns,
    toolCalls,
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
    const runtimeDeps = createRuntimeDeps();
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
      ...runtimeDeps,
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
    expect(runtimeDeps.toolCalls).toEqual([
      expect.objectContaining({
        toolName: "persist-segment-script-draft",
        status: "completed",
        argumentsSummary: expect.objectContaining({
          segmentId: "segment-1",
          lineCount: 1,
        }),
        resultSummary: expect.objectContaining({
          persistedSentenceCount: 1,
        }),
      }),
    ]);
  });

  it("commits character memory before segment draft even when input artifacts are reversed", async () => {
    const commitOrder: string[] = [];
    const tools = createPersistTools({
      upsertCharacterCandidates: async (input) => {
        commitOrder.push("character-memory-draft");
        for (const candidate of input.candidates) {
          input.characterMap.set(candidate.name, candidate.name);
          for (const alias of candidate.aliases) {
            input.characterMap.set(alias, candidate.name);
          }
        }
      },
      saveSegmentScriptToDatabase: async (input) => {
        commitOrder.push("segment-script-draft");
        const mappedSpeaker = input.characterMap.get(
          input.dialogueLines[0]?.characterName || ""
        );
        if (mappedSpeaker !== "宁采臣") {
          throw new Error("segment committed before character memory mapping");
        }
      },
    });
    const baseDraft = buildSegmentScriptDraft();
    const artifacts = [
      {
        kind: "segment-script-draft" as const,
        segmentScriptDraft: {
          ...baseDraft,
          lines: [
            {
              ...baseDraft.lines[0],
              speaker: "宁书生",
            },
          ],
        },
      },
      {
        kind: "character-memory-draft" as const,
        characterMemory: buildCharacterMemory(),
      },
    ];
    const runtimeDeps = createRuntimeDeps();

    const result = await runPersistStage({
      workflowRunId: "wf-persist-ordered-commit",
      bookId: "book-1",
      artifacts,
      tools,
      ...runtimeDeps,
    });

    const completed = asCompletedResult(result);
    expect(completed.artifact).toEqual({
      kind: "persisted-business-facts",
      persistedCharacterCount: 1,
      persistedSentenceCount: 1,
    });
    expect(commitOrder).toEqual([
      "character-memory-draft",
      "segment-script-draft",
    ]);
  });
});
