import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import {
  buildAgentContext,
  type RepairDecision,
  type SegmentScriptDraft,
} from "../../context";
import {
  canonicalizeSegmentScriptDraftSpeakers,
} from "../../runtime/character-memory/canonicalize";
import {
  buildCharacterResolutionHints,
} from "../../runtime/character-memory/summary";
import {
  createCharacterMemorySnapshot,
} from "../../runtime/character-memory/store";
import { validateAgentContract } from "../../runtime/agent-contract";
import {
  createRepairAgent,
  renderRepairUserPromptFromVariables,
} from "../../runtime/agents/repair-agent";
import {
  composeRuntimeSystemPrompt,
  loadSkillRuntimeBundle,
} from "../../runtime/load-skill-runtime-bundle";
import { fitPromptToBudget, resolvePromptBudgetLimit } from "../../runtime/prompt-budget";
import type { AgentRunRecord, ToolCallRecord } from "../../runtime/run-agent";
import { runStage, type StageRunRecord } from "../../runtime/run-stage";
import {
  buildSkillMetadataSnapshot,
  type SkillMetadataSnapshot,
} from "../../runtime/script-production-runtime-helpers";
import { validateSkillContract } from "../../runtime/skill-contract";
import type { TraceDependencies } from "../../runtime/write-trace";
import type {
  RunSegmentRepairStageInput,
  RunSegmentRepairStageResult,
  SegmentRepairArtifact,
} from "../../runtime/stages/run-segment-repair-stage";

interface SegmentRepairRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
  createToolCall?: (record: ToolCallRecord & { createdAt?: Date }) => Promise<void> | void;
  updateToolCall?: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

interface RepairSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

const defaultRepairSkillId = "json-repair";
const defaultMaxRepairDepth = 2;

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const resolveWorkspaceRoot = (workspaceRoot?: string): string => {
  if (workspaceRoot) {
    return workspaceRoot;
  }

  let current = process.cwd();

  for (let index = 0; index < 8; index += 1) {
    const hasSkills = fs.existsSync(path.join(current, "skills"));
    const hasApps = fs.existsSync(path.join(current, "apps"));
    if (hasSkills && hasApps) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return process.cwd();
};

const resolveRepairSkillSource = (params: {
  workspaceRoot?: string;
  skillDir?: string;
}): RepairSkillSource => {
  if (params.skillDir) {
    const resolvedSkillDir = path.resolve(params.skillDir);
    const skillsDir = path.dirname(resolvedSkillDir);

    if (path.basename(skillsDir) !== "skills") {
      throw new Error(
        `skillDir must target <workspace>/skills/<skill-id>: ${params.skillDir}`
      );
    }

    return {
      workspaceRoot: path.dirname(skillsDir),
      skillId: path.basename(resolvedSkillDir),
      skillDir: resolvedSkillDir,
    };
  }

  const workspaceRoot = resolveWorkspaceRoot(params.workspaceRoot);
  return {
    workspaceRoot,
    skillId: defaultRepairSkillId,
    skillDir: path.join(workspaceRoot, "skills", defaultRepairSkillId),
  };
};

const resolveAdapter = async (adapter?: LLMAdapter): Promise<LLMAdapter> => {
  if (adapter) {
    return adapter;
  }

  const { createDefaultLLMAdapter } = await import("../../adapters/llm-adapter");
  return createDefaultLLMAdapter();
};

const createManualReviewDecision = (segmentId: string): RepairDecision => ({
  segmentId,
  action: "manual_review",
  reason: "repair_depth_exceeded",
  retryable: false,
});

const createTrimmedFailedArtifactDecision = (
  segmentId: string
): RepairDecision => ({
  segmentId,
  action: "manual_review",
  reason: "repair_failed_artifact_trimmed",
  retryable: false,
});

const createInputRefinementDecision = (segmentId: string): RepairDecision => ({
  segmentId,
  action: "refine",
  reason: "input_refinement",
  retryable: true,
});

export const runMastraSegmentRepairStage = async (
  input: RunSegmentRepairStageInput,
  deps: SegmentRepairRuntimeDeps = {}
): Promise<RunSegmentRepairStageResult> => {
  const runtimeAgentId = "repair-agent";
  const maxRepairDepth = input.maxRepairDepth ?? defaultMaxRepairDepth;
  const promptBudget = {
    maxContextChars: 12000,
    reservedOutputChars: 5000,
  } as const;

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "segment_repair",
      agent: {
        id: runtimeAgentId,
        inputSummary: {
          segmentId: input.segmentId,
          failureKind: input.failureKind,
          repairDepth: input.repairDepth,
        },
        resolveFailure: () => "failed",
        execute: async () => {
          if (input.repairDepth >= maxRepairDepth) {
            return {
              status: "completed",
              output: {
                decision: createManualReviewDecision(input.segmentId),
              },
            };
          }

          if (input.failureKind === "input_refinement") {
            return {
              status: "completed",
              output: {
                decision: createInputRefinementDecision(input.segmentId),
              },
            };
          }

          const skillSource = resolveRepairSkillSource({
            workspaceRoot: input.workspaceRoot,
            skillDir: input.skillDir,
          });
          const skill = loadSkillRuntimeBundle(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          const agentContract = validateAgentContract({
            workspaceRoot: skillSource.workspaceRoot,
            agentSourceId: "repair",
            stageId: "segment_repair",
            skill: skill.definition,
            registeredTools: [],
          });
          validateSkillContract({
            skill: skill.definition,
            agentId: runtimeAgentId,
            expectedContextRequirements: [
              "segment",
              "failed_artifact",
              "character_memory_summary",
              "character_resolution_hints",
            ],
            expectedInputSchemaRef: "failed-segment-artifact",
            expectedOutputSchemaRef: "segment-script-draft",
          });

          const context = buildAgentContext({
            agentId: runtimeAgentId,
            segmentText: input.segmentText,
            failedArtifact: input.failedArtifact,
            characterMemory: input.characterMemory,
            budget: promptBudget,
          });
          const memorySnapshot = input.characterMemory
            ? createCharacterMemorySnapshot({
                memory: input.characterMemory,
              })
            : undefined;
          const characterMemorySummary =
            context.referenceMemory.characterMemorySummary;
          const characterResolutionHints = memorySnapshot
            ? buildCharacterResolutionHints(memorySnapshot)
            : "";

          if (context.executionContext.inputOverBudget) {
            return {
              status: "completed",
              output: {
                decision: createInputRefinementDecision(input.segmentId),
              },
            };
          }

          const runtimeSystemPrompt = composeRuntimeSystemPrompt({
            agentInstructions: agentContract.agentInstructions,
            skillInstructions: skill.instructions,
            systemPrompt: skill.systemPrompt,
          });
          const promptBudgetResult = fitPromptToBudget({
            systemPrompt: runtimeSystemPrompt,
            maxPromptChars: resolvePromptBudgetLimit(promptBudget),
            variables: {
              segment_text:
                typeof context.inputContext.segmentText === "string"
                  ? context.inputContext.segmentText
                  : "",
              failed_artifact_json: JSON.stringify(
                context.inputContext.failedArtifact ?? null,
                null,
                2
              ),
              character_memory_summary: characterMemorySummary,
              character_resolution_hints: characterResolutionHints,
            },
            trimOrder: [
              "failed_artifact_json",
              "character_resolution_hints",
              "character_memory_summary",
              "segment_text",
            ],
            variableStrategies: {
              failed_artifact_json: "json_summary",
              segment_text: "preserve_edges",
            },
            renderPrompt: (variables) =>
              renderRepairUserPromptFromVariables(skill.userPrompt, {
                segment_text: variables.segment_text,
                failed_artifact_json: variables.failed_artifact_json,
                character_memory_summary: variables.character_memory_summary,
                character_resolution_hints: variables.character_resolution_hints,
              }),
          });
          if (promptBudgetResult.overBudget) {
            return {
              status: "completed",
              output: {
                decision: createInputRefinementDecision(input.segmentId),
              },
            };
          }
          if (
            input.failureKind !== "semantic_retry" &&
            promptBudgetResult.trimmedKeys.includes("failed_artifact_json")
          ) {
            return {
              status: "completed",
              output: {
                decision: createTrimmedFailedArtifactDecision(input.segmentId),
              },
            };
          }

          const adapter = await resolveAdapter(input.adapter);
          const agent = createRepairAgent({
            adapter,
            now: deps.now ?? input.now,
          });
          const result = await agent.execute({
            segmentId: input.segmentId,
            segmentText: promptBudgetResult.variables.segment_text,
            failedArtifact: promptBudgetResult.variables.failed_artifact_json,
            failureKind:
              input.failureKind === "semantic_retry"
                ? "semantic_retry"
                : "format_repair",
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

          return {
            status: "completed",
            output: {
              skillId: skill.definition.id,
              skillMetadata,
              decision: result.decision,
              memoryVersion: memorySnapshot?.version,
              repairedDraft:
                result.repairedDraft && memorySnapshot
                  ? canonicalizeSegmentScriptDraftSpeakers({
                      draft: result.repairedDraft,
                      snapshot: memorySnapshot,
                    }).draft
                  : result.repairedDraft,
              provider: result.provider,
              model: result.model,
            },
          };
        },
      },
    },
    createId: deps.createId ?? input.createId ?? createRuntimeId,
    appendTrace:
      deps.appendTrace ?? input.appendTrace ?? (async () => undefined),
    now: deps.now ?? input.now,
    createStageRun:
      deps.createStageRun ?? input.createStageRun ?? (async () => undefined),
    updateStageRun: deps.updateStageRun ?? input.updateStageRun,
    createAgentRun: deps.createAgentRun ?? input.createAgentRun,
    updateAgentRun: deps.updateAgentRun ?? input.updateAgentRun,
    createToolCall: deps.createToolCall ?? input.createToolCall,
    updateToolCall: deps.updateToolCall ?? input.updateToolCall,
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
      agentRunId: stageResult.agent.runId,
      status: stageResult.status,
      error: stageResult.agent.error,
      failedArtifact: stageResult.agent.output?.failedArtifact,
    };
  }

  const decision =
    (stageResult.agent.output?.decision as RepairDecision | undefined) ??
    createManualReviewDecision(input.segmentId);
  const repairedDraft = stageResult.agent.output
    ?.repairedDraft as SegmentScriptDraft | undefined;
  const skillId =
    typeof stageResult.agent.output?.skillId === "string"
      ? stageResult.agent.output.skillId
      : defaultRepairSkillId;

  const artifact: SegmentRepairArtifact | undefined =
    decision.action === "retry" && repairedDraft
      ? {
          kind: "segment-script-draft",
          skillId,
          segmentScriptDraft: repairedDraft,
          memoryVersion:
            typeof stageResult.agent.output?.memoryVersion === "number"
              ? stageResult.agent.output.memoryVersion
              : undefined,
          skillMetadata: stageResult.agent.output
            ?.skillMetadata as SkillMetadataSnapshot | undefined,
        }
      : undefined;

  return {
    stageRunId: stageResult.id,
    agentRunId: stageResult.agent.runId,
    status: "completed",
    decision,
    skillMetadata: stageResult.agent.output
      ?.skillMetadata as SkillMetadataSnapshot | undefined,
    artifact,
  };
};
