import type { SegmentScriptDraft, ValidationReport } from "../context";
import { finalizeSegment } from "../runtime/script-production/finalize-segment";
import type { ScriptProductionRuntimeStore } from "../runtime/script-production-runtime-store";
import type { RunSingleSegmentParams } from "../runtime/script-production/run-single-segment-types";

const createDraft = (): SegmentScriptDraft => ({
  segmentId: "segment-1",
  createdAt: "2026-04-09T00:00:00.000Z",
  lines: [
    {
      id: "line-1",
      sourceText: "宁书生抱拳道：“在下告辞。”",
      text: "在下告辞。",
      speaker: "宁书生",
      orderInSegment: 0,
    },
  ],
});

const createValidationReport = (): ValidationReport => ({
  segmentId: "segment-1",
  valid: true,
  coverageRatio: 1,
  issues: [],
});

const createRuntimeStore = () => {
  const artifacts: Array<{
    artifactKind: string;
    payload: unknown;
  }> = [];

  const runtimeStore: ScriptProductionRuntimeStore = {
    createWorkflowRun: async () => undefined,
    updateWorkflowRun: async () => undefined,
    createStageRun: async () => undefined,
    updateStageRun: async () => undefined,
    createAgentRun: async () => undefined,
    updateAgentRun: async () => undefined,
    createToolCall: async () => undefined,
    updateToolCall: async () => undefined,
    createRuntimeArtifact: async (record) => {
      artifacts.push({
        artifactKind: record.artifactKind,
        payload: record.payload,
      });
    },
    appendTrace: async () => undefined,
  };

  return {
    runtimeStore,
    artifacts,
  };
};

const createContext = (deps?: {
  runtimeStore?: ScriptProductionRuntimeStore;
  runQualityStage?: RunSingleSegmentParams["runQualityStage"];
  runPersistStage?: RunSingleSegmentParams["runPersistStage"];
}): RunSingleSegmentParams => {
  let nextId = 0;

  return {
    workflowRunId: "workflow-1",
    bookId: "book-1",
    segment: {
      id: "segment-1",
      chapterId: "chapter-1",
      orderIndex: 0,
      content: "宁书生抱拳道：“在下告辞。”",
    },
    adapter: {
      call: jest.fn(),
    },
    runtimeStore:
      deps?.runtimeStore ??
      createRuntimeStore().runtimeStore,
    characterProfiles: [
      {
        id: "char-ning",
        canonicalName: "宁采臣",
        aliases: [{ alias: "宁书生" }],
      },
    ],
    characterMap: new Map([
      ["宁采臣", "宁采臣"],
      ["宁书生", "宁采臣"],
    ]),
    createId: () => `runtime-${nextId++}`,
    now: () => new Date("2026-04-09T00:00:00.000Z"),
    semanticRetryDepth: 0,
    inputRefinementDepth: 0,
    createStageRun: async () => undefined,
    updateStageRun: async () => undefined,
    createAgentRun: async () => undefined,
    updateAgentRun: async () => undefined,
    createToolCall: async () => undefined,
    updateToolCall: async () => undefined,
    appendTrace: async () => undefined,
    runQualityStage:
      deps?.runQualityStage ??
      (async () =>
        ({
          stageRunId: "quality-stage-1",
          status: "completed",
          decision: "auto_pass",
          verdict: {
            segmentId: "segment-1",
            verdict: "pass",
            score: 0.95,
            reasons: ["speaker canonicalized"],
          },
        }) as any),
    runPersistStage:
      deps?.runPersistStage ??
      (async () =>
        ({
          stageRunId: "persist-stage-1",
          status: "completed",
          artifact: {
            kind: "persisted-business-facts",
            persistedCharacterCount: 0,
            persistedSentenceCount: 1,
          },
        }) as any),
  };
};

describe("finalize segment", () => {
  it("canonicalizes in finalize, then sends the same canonicalized draft to quality and persist", async () => {
    const { runtimeStore, artifacts } = createRuntimeStore();
    const runQualityStage = jest.fn().mockResolvedValue({
      stageRunId: "quality-stage-1",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "segment-1",
        verdict: "pass",
        score: 0.95,
        reasons: ["speaker canonicalized"],
      },
    });
    const runPersistStage = jest.fn().mockResolvedValue({
      stageRunId: "persist-stage-1",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    });

    const result = await finalizeSegment({
      context: createContext({
        runtimeStore,
        runQualityStage,
        runPersistStage,
      }),
      draft: createDraft(),
      validationReport: createValidationReport(),
      counters: {
        persistedSentenceCount: 0,
        persistedCharacterCount: 0,
        formatRepairCount: 0,
        semanticRetryCount: 0,
      },
    });

    expect(result.status).toBe("success");
    const persistedDraft = runPersistStage.mock.calls[0]?.[0]?.artifacts?.[0]
      ?.segmentScriptDraft as SegmentScriptDraft;
    const storedDraft = artifacts.find(
      (artifact) => artifact.artifactKind === "segment-script-draft"
    )?.payload as SegmentScriptDraft | undefined;
    const returnedDraft =
      result.status === "success" ? result.draft : undefined;
    const qualityInput = runQualityStage.mock.calls[0]?.[0] as
      | {
          segmentScriptDraft?: SegmentScriptDraft;
          characterResolutionEvidence?: {
            resolvedSpeakers?: Array<{
              raw: string;
              canonical: string;
              reason: string;
            }>;
          };
        }
      | undefined;

    expect(persistedDraft.lines[0]?.speaker).toBe("宁采臣");
    expect(qualityInput?.segmentScriptDraft?.lines[0]?.speaker).toBe("宁采臣");
    expect(qualityInput?.characterResolutionEvidence?.resolvedSpeakers).toEqual([
      { raw: "宁书生", canonical: "宁采臣", reason: "alias_match" },
    ]);
    expect(storedDraft?.lines[0]?.speaker).toBe("宁采臣");
    expect(returnedDraft?.lines[0]?.speaker).toBe("宁采臣");
    expect(returnedDraft).toEqual(persistedDraft);
    expect(storedDraft).toEqual(persistedDraft);
  });

  it("forwards upstream failed artifact and quality signals into quality stage", async () => {
    const { runtimeStore } = createRuntimeStore();
    const runQualityStage = jest.fn().mockResolvedValue({
      stageRunId: "quality-stage-2",
      status: "completed",
      decision: "auto_pass",
      verdict: {
        segmentId: "segment-1",
        verdict: "pass",
        score: 0.92,
        reasons: ["repair history reviewed"],
      },
    });

    await finalizeSegment({
      context: createContext({
        runtimeStore,
        runQualityStage,
      }),
      draft: createDraft(),
      validationReport: createValidationReport(),
      counters: {
        persistedSentenceCount: 0,
        persistedCharacterCount: 0,
        formatRepairCount: 1,
        semanticRetryCount: 1,
      },
      failedArtifact: {
        kind: "validation-failure",
        rawResponse: "{\"broken\":true}",
      },
      qualitySignals: {
        upstreamWarnings: ["semantic_retry_recovered"],
        forceManualReview: true,
      },
    });

    expect(runQualityStage).toHaveBeenCalledWith(
      expect.objectContaining({
        failedArtifact: {
          kind: "validation-failure",
          rawResponse: "{\"broken\":true}",
        },
        qualitySignals: {
          upstreamWarnings: ["semantic_retry_recovered"],
          forceManualReview: true,
        },
      })
    );
  });

  it("persists the canonicalized draft when quality stage requires manual review", async () => {
    const { runtimeStore } = createRuntimeStore();
    const runQualityStage = jest.fn().mockResolvedValue({
      stageRunId: "quality-stage-review-1",
      status: "completed",
      decision: "manual_review_required",
      verdict: {
        segmentId: "segment-1",
        verdict: "manual_review",
        score: 0.62,
        reasons: ["需要人工复核"],
      },
      handoff: {
        segmentId: "segment-1",
        summary: "需要人工复核",
        reasons: ["需要人工复核"],
        evidence: {
          score: 0.62,
          confidence: 0.48,
          validation: {
            coverageRatio: 1,
            issues: [],
          },
        },
      },
    });
    const runPersistStage = jest.fn().mockResolvedValue({
      stageRunId: "persist-stage-review-1",
      status: "completed",
      artifact: {
        kind: "persisted-business-facts",
        persistedCharacterCount: 0,
        persistedSentenceCount: 1,
      },
    });

    const result = await finalizeSegment({
      context: createContext({
        runtimeStore,
        runQualityStage,
        runPersistStage,
      }),
      draft: createDraft(),
      validationReport: createValidationReport(),
      counters: {
        persistedSentenceCount: 0,
        persistedCharacterCount: 0,
        formatRepairCount: 0,
        semanticRetryCount: 0,
      },
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("expected success result");
    }
    expect(runPersistStage).toHaveBeenCalledTimes(1);
    expect(result.manualReviewFailure).toMatchObject({
      segmentId: "segment-1",
      stage: "quality_judgement",
      errorCode: "QUALITY_MANUAL_REVIEW_REQUIRED",
      message: "需要人工复核",
      issueCodes: ["QUALITY_MANUAL_REVIEW_REQUIRED"],
      issueMessages: ["需要人工复核"],
    });
  });
});
