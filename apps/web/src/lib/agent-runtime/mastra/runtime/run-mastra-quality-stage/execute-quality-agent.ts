// 一旦我被更新，请更新我的开头注释
// input: quality stage 输入/skill runtime bundle
// output: mastra quality agent 执行体
// pos: agent runtime mastra
import {
  createQualityJudgeAgent,
  renderQualityJudgeUserPromptFromVariables,
} from "../../../runtime/agents/quality-judge-agent";
import { validateAgentContract } from "../../../runtime/agent-contract";
import { buildCharacterMemorySummary } from "../../../runtime/character-memory/summary";
import { createCharacterMemorySnapshot } from "../../../runtime/character-memory/store";
import {
  composeRuntimeSystemPrompt,
  loadSkillRuntimeBundle,
} from "../../../runtime/load-skill-runtime-bundle";
import { summarizePromptArtifact } from "../../../runtime/prompt-artifact-summary";
import {
  fitPromptToBudget,
  resolvePromptBudgetLimit,
} from "../../../runtime/prompt-budget";
import {
  buildSkillMetadataSnapshot,
  type SkillMetadataSnapshot,
} from "../../../runtime/script-production-runtime-helpers";
import { validateSkillContract } from "../../../runtime/skill-contract";
import type { RunQualityStageInput } from "../../../runtime/stages/run-quality-stage";
import {
  createManualReviewHandoff,
  QUALITY_STAGE_PROMPT_BUDGET,
  resolveAdapter,
  resolveDeterministicDecision,
  resolveQualitySkillSource,
  resolveSemanticDecision,
  normalizeSemanticVerdictForCharacterResolution,
  type StageOutput,
} from "./helpers";

interface ExecuteQualityAgentResult {
  status: "completed";
  output: StageOutput & {
    skillMetadata?: SkillMetadataSnapshot;
  };
}

const runtimeAgentId = "quality-judge-agent";

export const executeMastraQualityAgent = async (params: {
  input: RunQualityStageInput;
  coreQualityEvidenceKeys: Set<string>;
}): Promise<ExecuteQualityAgentResult> => {
  const { input } = params;
  const deterministicDecision = resolveDeterministicDecision(input);
  if (deterministicDecision) {
    return {
      status: "completed",
      output: deterministicDecision,
    };
  }

  const skillSource = resolveQualitySkillSource({
    workspaceRoot: input.workspaceRoot,
    skillDir: input.skillDir,
  });
  const skill = loadSkillRuntimeBundle(
    skillSource.workspaceRoot,
    skillSource.skillId
  );
  const agentContract = validateAgentContract({
    workspaceRoot: skillSource.workspaceRoot,
    agentSourceId: "quality-judge",
    stageId: "quality_judgement",
    skill: skill.definition,
    registeredTools: [],
  });
  validateSkillContract({
    skill: skill.definition,
    agentId: runtimeAgentId,
    expectedContextRequirements: [
      "segment_script_draft",
      "validation_report",
      "quality_signals",
      "failed_artifact",
      "character_memory_summary",
      "character_resolution_evidence",
    ],
    expectedInputSchemaRef: "quality-stage-input",
    expectedOutputSchemaRef: "quality-verdict",
  });

  const failedArtifactSummary = summarizePromptArtifact(input.failedArtifact);
  const memorySnapshot = input.characterMemory
    ? createCharacterMemorySnapshot({
        memory: input.characterMemory,
      })
    : undefined;
  const characterMemorySummary = memorySnapshot
    ? buildCharacterMemorySummary(memorySnapshot)
    : "";
  const runtimeSystemPrompt = composeRuntimeSystemPrompt({
    agentInstructions: agentContract.agentInstructions,
    skillInstructions: skill.instructions,
    systemPrompt: skill.systemPrompt,
  });
  const promptBudgetResult = fitPromptToBudget({
    systemPrompt: runtimeSystemPrompt,
    maxPromptChars: resolvePromptBudgetLimit(QUALITY_STAGE_PROMPT_BUDGET),
    variables: {
      segment_script_draft_json: JSON.stringify(input.segmentScriptDraft, null, 2),
      validation_report_json: JSON.stringify(input.validationReport, null, 2),
      quality_signals_json: JSON.stringify(input.qualitySignals ?? {}, null, 2),
      failed_artifact_json: JSON.stringify(failedArtifactSummary, null, 2),
      character_memory_summary: characterMemorySummary,
      character_resolution_evidence_json: JSON.stringify(
        input.characterResolutionEvidence ?? null,
        null,
        2
      ),
    },
    trimOrder: [
      // ---------- 先裁剪辅助证据，核心判断材料不能被预算器裁掉 ----------
      "failed_artifact_json",
      "character_memory_summary",
      "quality_signals_json",
    ],
    variableStrategies: {
      failed_artifact_json: "json_summary",
      quality_signals_json: "json_summary",
    },
    renderPrompt: (variables: Record<string, string>) =>
      renderQualityJudgeUserPromptFromVariables(skill.userPrompt, {
        segment_script_draft_json: variables.segment_script_draft_json,
        validation_report_json: variables.validation_report_json,
        quality_signals_json: variables.quality_signals_json,
        failed_artifact_json: variables.failed_artifact_json,
        character_memory_summary: variables.character_memory_summary,
        character_resolution_evidence_json:
          variables.character_resolution_evidence_json,
      }),
  });

  const overBudgetResult = buildOverBudgetResult(
    input,
    promptBudgetResult.overBudget
  );
  if (overBudgetResult) {
    return overBudgetResult;
  }

  const trimmedCoreEvidenceResult = buildTrimmedEvidenceResult(
    input,
    promptBudgetResult.trimmedKeys.filter((key: string) =>
      params.coreQualityEvidenceKeys.has(key)
    )
  );
  if (trimmedCoreEvidenceResult) {
    return trimmedCoreEvidenceResult;
  }

  const characterResolutionResult = buildCharacterResolutionReviewResult(input);
  if (characterResolutionResult) {
    return characterResolutionResult;
  }

  const adapter = await resolveAdapter(input.adapter);
  const agent = createQualityJudgeAgent({ adapter });
  const result = await agent.execute({
    segmentId: input.segmentId,
    segmentScriptDraft: input.segmentScriptDraft,
    validationReport: input.validationReport,
    qualitySignals: input.qualitySignals,
    failedArtifact: failedArtifactSummary ?? input.failedArtifact ?? null,
    characterMemorySummary,
    characterResolutionEvidence: input.characterResolutionEvidence ?? null,
    modelPolicy: skill.definition.modelPolicy!,
    renderedUserPrompt: promptBudgetResult.prompt,
    prompts: {
      systemPrompt: runtimeSystemPrompt,
      userPrompt: skill.userPrompt,
    },
  });
  const skillMetadata = buildSkillMetadataSnapshot(skill.definition, {
    runtimeSystemPrompt,
    systemPrompt: skill.systemPrompt,
    userPrompt: skill.userPrompt,
  });
  const semanticVerdict = normalizeSemanticVerdictForCharacterResolution({
    verdict: result.verdict,
    confidence: result.confidence,
    summary: result.summary,
    characterResolutionEvidence: input.characterResolutionEvidence,
  });
  const decision = resolveSemanticDecision({
    segmentId: input.segmentId,
    verdict: semanticVerdict.verdict,
    confidence: semanticVerdict.confidence,
    summary: semanticVerdict.summary,
    validationReport: input.validationReport,
    qualitySignals: input.qualitySignals,
    unresolvedSpeakers: input.characterResolutionEvidence?.unresolvedSpeakers,
    aliasConflictCount: input.characterResolutionEvidence?.aliasConflicts.length,
  });

  return {
    status: "completed",
    output: {
      ...decision,
      skillMetadata,
    },
  };
};

const buildOverBudgetResult = (
  input: RunQualityStageInput,
  overBudget: boolean
): ExecuteQualityAgentResult | null => {
  if (!overBudget) {
    return null;
  }

  return {
    status: "completed",
    output: {
      decision: "manual_review_required",
      verdict: {
        segmentId: input.segmentId,
        verdict: "manual_review",
        score: 0,
        reasons: ["quality_prompt_over_budget"],
      },
      handoff: createManualReviewHandoff({
        segmentId: input.segmentId,
        summary: "quality_prompt_over_budget",
        reasons: ["quality_prompt_over_budget"],
        score: 0,
        confidence: 0,
        validationReport: input.validationReport,
      }),
    },
  };
};

const buildTrimmedEvidenceResult = (
  input: RunQualityStageInput,
  trimmedCoreEvidenceKeys: string[]
): ExecuteQualityAgentResult | null => {
  if (trimmedCoreEvidenceKeys.length === 0) {
    return null;
  }

  const trimmedCoreEvidenceDetail = `trimmed_core_evidence:${trimmedCoreEvidenceKeys.join(
    ","
  )}`;
  const reasons = [
    "quality_prompt_core_evidence_trimmed",
    trimmedCoreEvidenceDetail,
  ];

  return {
    status: "completed",
    output: {
      decision: "manual_review_required",
      verdict: {
        segmentId: input.segmentId,
        verdict: "manual_review",
        score: 0,
        reasons,
      },
      handoff: createManualReviewHandoff({
        segmentId: input.segmentId,
        summary: "quality_prompt_core_evidence_trimmed",
        reasons,
        score: 0,
        confidence: 0,
        validationReport: input.validationReport,
      }),
    },
  };
};

const buildCharacterResolutionReviewResult = (
  input: RunQualityStageInput
): ExecuteQualityAgentResult | null => {
  const unresolvedSpeakers =
    input.characterResolutionEvidence?.unresolvedSpeakers ?? [];
  const aliasConflicts = input.characterResolutionEvidence?.aliasConflicts ?? [];
  if (unresolvedSpeakers.length === 0 && aliasConflicts.length === 0) {
    return null;
  }

  const score = Number(input.validationReport.coverageRatio.toFixed(4));
  const reasons: string[] = [];

  if (unresolvedSpeakers.length > 0) {
    reasons.push("unresolved_speakers_present");
  }
  if (aliasConflicts.length > 0) {
    reasons.push("alias_conflicts_present");
  }

  return {
    status: "completed",
    output: {
      decision: "manual_review_required",
      verdict: {
        segmentId: input.segmentId,
        verdict: "manual_review",
        score,
        reasons,
      },
      handoff: createManualReviewHandoff({
        segmentId: input.segmentId,
        summary: "character_resolution_requires_manual_review",
        reasons,
        score,
        confidence: 1,
        validationReport: input.validationReport,
      }),
    },
  };
};
