import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import { runSegmentRepairStage } from "../runtime/stages/run-segment-repair-stage";

const createMockAdapter = (content: string): LLMAdapter => ({
  call: jest.fn().mockResolvedValue({
    content,
    provider: "mock-provider",
    model: "mock-model",
    latencyMs: 5,
    usage: null,
  }),
});

const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const skillDir = path.join(workspaceRoot, "skills/json-repair");

describe("segment repair stage", () => {
  it("routes broken structured output to format_repair and returns repaired draft", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-format-1",
      segmentId: "segment-1",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: "not-json",
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.decision).toMatchObject({
      segmentId: "segment-1",
      action: "retry",
      retryable: true,
    });
    expect(result.artifact?.kind).toBe("segment-script-draft");
    expect(result.artifact?.segmentScriptDraft.lines).toHaveLength(1);
    expect(adapter.call).toHaveBeenCalledTimes(1);
  });

  it("routes semantic validation failures to semantic_retry without calling adapter", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [],
      })
    );

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-semantic-1",
      segmentId: "segment-2",
      segmentText: "宁采臣抬头。燕赤霞点头。",
      failureKind: "semantic_retry",
      failedArtifact: {
        segmentId: "segment-2",
      },
      validationReport: {
        segmentId: "segment-2",
        valid: false,
        coverageRatio: 0.62,
        issues: [
          {
            code: "LOW_COVERAGE",
            message: "coverage below threshold",
          },
        ],
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.decision).toEqual({
      segmentId: "segment-2",
      action: "retry",
      reason: "semantic_retry",
      retryable: true,
    });
    expect(result.artifact).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("routes over-budget failures to input_refinement without calling adapter", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [],
      })
    );

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-refine-1",
      segmentId: "segment-3",
      segmentText: "甲".repeat(8000),
      failureKind: "input_refinement",
      failedArtifact: {
        segmentId: "segment-3",
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.decision).toEqual({
      segmentId: "segment-3",
      action: "refine",
      reason: "input_refinement",
      retryable: true,
    });
    expect(result.artifact).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("returns manual_review when repair depth exceeds threshold", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-depth-1",
      segmentId: "segment-4",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: "not-json",
      repairDepth: 2,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.decision).toEqual({
      segmentId: "segment-4",
      action: "manual_review",
      reason: "repair_depth_exceeded",
      retryable: false,
    });
    expect(result.artifact).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });
});
