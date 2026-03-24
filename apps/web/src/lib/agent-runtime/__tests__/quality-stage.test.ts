import type { LLMAdapter } from "../adapters/llm-adapter";
import type { SegmentScriptDraft, ValidationReport } from "../context";
import {
  runQualityStage,
  type RunQualityStageResult,
} from "../runtime/stages/run-quality-stage";
import fs from "fs";
import os from "os";
import path from "path";

const createMockAdapter = (content: string): LLMAdapter => ({
  call: jest.fn().mockResolvedValue({
    content,
    provider: "mock-provider",
    model: "mock-model",
    latencyMs: 5,
    usage: null,
  }),
});

const createDraft = (segmentId: string): SegmentScriptDraft => ({
  segmentId,
  lines: [
    {
      id: `${segmentId}-line-1`,
      sourceText: "宁采臣抬头。",
      text: "宁采臣抬头。",
      speaker: "旁白",
      orderInSegment: 0,
    },
  ],
  createdAt: "2026-03-24T00:00:00.000Z",
});

const createValidationReport = (
  segmentId: string,
  partial?: Partial<ValidationReport>
): ValidationReport => ({
  segmentId,
  valid: true,
  coverageRatio: 1,
  issues: [],
  ...partial,
});

const asCompletedResult = (
  result: RunQualityStageResult
): Extract<RunQualityStageResult, { status: "completed" }> => {
  if (result.status !== "completed") {
    throw new Error(`Expected completed status, received ${result.status}`);
  }
  return result;
};

const createQualitySkillFixture = (params?: {
  skillId?: string;
  compatibleAgents?: string[];
  contextRequirements?: string[];
  outputSchemaRef?: string;
}) => {
  const skillId = params?.skillId ?? "quality-judgement";
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "quality-stage-"));
  const fixtureSkillDir = path.join(fixtureRoot, "skills", skillId);

  fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureSkillDir, "skill.toml"),
    [
      `id = "${skillId}"`,
      'version = "1"',
      'kind = "quality"',
      `compatibleAgents = [${(params?.compatibleAgents ?? ["quality-judge-agent"])
        .map((agentId) => `"${agentId}"`)
        .join(", ")}]`,
      'inputSchemaRef = "quality-stage-input"',
      `outputSchemaRef = "${params?.outputSchemaRef ?? "quality-verdict"}"`,
      `contextRequirements = [${(params?.contextRequirements ?? [
        "segment_script_draft",
        "validation_report",
        "quality_signals",
        "failed_artifact",
      ])
        .map((requirement) => `"${requirement}"`)
        .join(", ")}]`,
      "toolAllowlist = []",
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(path.join(fixtureSkillDir, "SKILL.md"), "# Fixture\n", "utf8");
  fs.writeFileSync(path.join(fixtureSkillDir, "prompts/system.md"), "return json", "utf8");
  fs.writeFileSync(
    path.join(fixtureSkillDir, "prompts/user.md"),
    "{{segment_script_draft_json}} {{validation_report_json}} {{quality_signals_json}} {{failed_artifact_json}}",
    "utf8"
  );

  return fixtureSkillDir;
};

describe("quality stage", () => {
  it("does not call adapter and returns fail branch when deterministic validation does not pass", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 0.99,
        confidence: 0.99,
        reasons: ["should not be consumed"],
        summary: "should not be consumed",
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-deterministic-fail-1",
      segmentId: "segment-deterministic-fail-1",
      segmentScriptDraft: createDraft("segment-deterministic-fail-1"),
      validationReport: createValidationReport("segment-deterministic-fail-1", {
        valid: false,
        coverageRatio: 0.42,
        issues: [
          {
            code: "LOW_COVERAGE",
            message: "coverage below deterministic threshold",
          },
        ],
      }),
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toBe("auto_fail");
    expect(completed.verdict).toEqual({
      segmentId: "segment-deterministic-fail-1",
      verdict: "fail",
      score: 0.42,
      reasons: ["LOW_COVERAGE: coverage below deterministic threshold"],
    });
    expect(completed.handoff).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("invokes quality judge agent when deterministic validation passes and returns QualityVerdict", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 0.93,
        confidence: 0.94,
        reasons: ["角色语气一致", "未发现语义冲突"],
        summary: "语义质量稳定，可自动通过",
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-pass-1",
      segmentId: "segment-quality-pass-1",
      segmentScriptDraft: createDraft("segment-quality-pass-1"),
      validationReport: createValidationReport("segment-quality-pass-1"),
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toBe("auto_pass");
    expect(completed.verdict).toEqual({
      segmentId: "segment-quality-pass-1",
      verdict: "pass",
      score: 0.93,
      reasons: ["角色语气一致", "未发现语义冲突"],
    });
    expect(completed.handoff).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(1);
  });

  it("converts low score output into manual_review_required", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 0.58,
        confidence: 0.87,
        reasons: ["角色一致性不足"],
        summary: "存在明显语义质量风险",
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-low-score-1",
      segmentId: "segment-quality-low-score-1",
      segmentScriptDraft: createDraft("segment-quality-low-score-1"),
      validationReport: createValidationReport("segment-quality-low-score-1"),
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toBe("manual_review_required");
    expect(completed.verdict.verdict).toBe("manual_review");
    expect(completed.verdict.score).toBe(0.58);
    expect(completed.handoff).toMatchObject({
      segmentId: "segment-quality-low-score-1",
      reasons: ["角色一致性不足"],
      summary: "存在明显语义质量风险",
    });
    expect(adapter.call).toHaveBeenCalledTimes(1);
  });

  it("includes minimal evidence package for low confidence manual review handoff", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 0.86,
        confidence: 0.49,
        reasons: ["证据不充分，判断置信不足"],
        summary: "模型对结果稳定性缺少把握",
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-low-confidence-1",
      segmentId: "segment-quality-low-confidence-1",
      segmentScriptDraft: createDraft("segment-quality-low-confidence-1"),
      validationReport: createValidationReport("segment-quality-low-confidence-1"),
      qualitySignals: {
        upstreamWarnings: ["speaker_distribution_sparse"],
      },
      failedArtifact: {
        stage: "segment_scripting",
      },
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toBe("manual_review_required");
    expect(completed.verdict.verdict).toBe("manual_review");
    expect(completed.handoff).toEqual({
      segmentId: "segment-quality-low-confidence-1",
      summary: "模型对结果稳定性缺少把握",
      reasons: ["证据不充分，判断置信不足"],
      evidence: {
        score: 0.86,
        confidence: 0.49,
        validation: {
          coverageRatio: 1,
          issues: [],
        },
      },
    });
    expect(adapter.call).toHaveBeenCalledTimes(1);
  });

  it("routes deterministic soft failures to manual review without calling adapter", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 0.99,
        confidence: 0.99,
        reasons: ["should not be consumed"],
        summary: "should not be consumed",
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-deterministic-review-1",
      segmentId: "segment-deterministic-review-1",
      segmentScriptDraft: createDraft("segment-deterministic-review-1"),
      validationReport: createValidationReport("segment-deterministic-review-1", {
        valid: false,
        coverageRatio: 0.76,
        issues: [
          {
            code: "SPEAKER_AMBIGUOUS",
            message: "speaker mapping is ambiguous",
          },
        ],
      }),
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toBe("manual_review_required");
    expect(completed.verdict).toEqual({
      segmentId: "segment-deterministic-review-1",
      verdict: "manual_review",
      score: 0.76,
      reasons: ["SPEAKER_AMBIGUOUS: speaker mapping is ambiguous"],
    });
    expect(completed.handoff).toBeDefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("forces manual review when qualitySignals request it", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 0.95,
        confidence: 0.93,
        reasons: ["结果整体稳定"],
        summary: "主动触发人工审核",
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-force-review-1",
      segmentId: "segment-force-review-1",
      segmentScriptDraft: createDraft("segment-force-review-1"),
      validationReport: createValidationReport("segment-force-review-1"),
      qualitySignals: {
        forceManualReview: true,
      },
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toBe("manual_review_required");
    expect(completed.verdict.verdict).toBe("manual_review");
  });

  it("fails stage when quality judge returns malformed payload", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 2,
        confidence: 0.6,
        reasons: [],
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-invalid-payload-1",
      segmentId: "segment-invalid-payload-1",
      segmentScriptDraft: createDraft("segment-invalid-payload-1"),
      validationReport: createValidationReport("segment-invalid-payload-1"),
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("handoff" in result).toBe(false);
  });

  it("fails stage when skill contract is incompatible and does not call adapter", async () => {
    const fixtureSkillDir = createQualitySkillFixture({
      contextRequirements: ["segment_script_draft", "validation_report"],
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        score: 0.9,
        confidence: 0.9,
        reasons: ["should not be consumed"],
      })
    );

    const result = await runQualityStage({
      workflowRunId: "wf-quality-contract-mismatch-1",
      segmentId: "segment-contract-mismatch-1",
      segmentScriptDraft: createDraft("segment-contract-mismatch-1"),
      validationReport: createValidationReport("segment-contract-mismatch-1"),
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });
});
