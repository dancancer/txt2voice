import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import {
  buildAgentContext,
  type CharacterMemory,
  type RepairDecision,
  type SegmentScriptDraft,
  type ValidationReport,
} from "../../context";
import type { StageExecutor } from "../executor-policy";
import { loadSkillDefinition } from "../../registry";
import { createRepairAgent } from "../agents/repair-agent";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import { runStage, type StageRunRecord } from "../run-stage";
import type { SkillMetadataSnapshot } from "../script-production-runtime-helpers";
import type { TraceDependencies } from "../write-trace";

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

export type SegmentRepairFailureKind =
  | "format_repair"
  | "semantic_retry"
  | "input_refinement";

export interface RunSegmentRepairStageInput extends SegmentRepairRuntimeDeps {
  workflowRunId: string;
  segmentId: string;
  segmentText: string;
  failureKind: SegmentRepairFailureKind;
  failedArtifact: unknown;
  validationReport?: ValidationReport;
  repairDepth: number;
  maxRepairDepth?: number;
  characterMemory?: CharacterMemory;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
  executor?: StageExecutor;
  shadowMode?: boolean;
  onShadowResult?: (
    result: RunSegmentRepairStageResult
  ) => Promise<void> | void;
  runMastraSegmentRepairStage?: (
    input: RunSegmentRepairStageInput
  ) => Promise<RunSegmentRepairStageResult>;
}

export interface SegmentRepairArtifact {
  kind: "segment-script-draft";
  skillId: string;
  segmentScriptDraft: SegmentScriptDraft;
  memoryVersion?: number;
  skillMetadata?: SkillMetadataSnapshot;
}

interface RunSegmentRepairStageCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "completed";
  decision: RepairDecision;
  skillMetadata?: SkillMetadataSnapshot;
  artifact?: SegmentRepairArtifact;
}

interface RunSegmentRepairStageNonCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
  failedArtifact?: unknown;
}

export type RunSegmentRepairStageResult =
  | RunSegmentRepairStageCompletedResult
  | RunSegmentRepairStageNonCompletedResult;

interface RepairSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const defaultRepairSkillId = "json-repair";
const defaultMaxRepairDepth = 2;

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

const readRequiredFile = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
};

const loadRepairPrompts = (skillDir: string) => ({
  systemPrompt: readRequiredFile(path.join(skillDir, "prompts/system.md")),
  userPrompt: readRequiredFile(path.join(skillDir, "prompts/user.md")),
});

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

const assertSkillCompatibleWithAgent = (
  skillId: string,
  compatibleAgents: string[],
  agentId: string
) => {
  if (compatibleAgents.includes(agentId)) {
    return;
  }

  throw new Error(`Skill ${skillId} is not compatible with ${agentId}`);
};

const assertSkillContract = (definition: {
  id: string;
  contextRequirements: string[];
  toolAllowlist: string[];
  outputSchemaRef: string;
}) => {
  const expectedRequirements = new Set(["segment", "failed_artifact"]);
  if (
    definition.contextRequirements.length !== expectedRequirements.size ||
    definition.contextRequirements.some(
      (requirement) => !expectedRequirements.has(requirement)
    )
  ) {
    throw new Error(
      `Skill ${definition.id} has unsupported contextRequirements: expected ["segment", "failed_artifact"]`
    );
  }

  if (definition.toolAllowlist.length > 0) {
    throw new Error(`Skill ${definition.id} must declare empty toolAllowlist`);
  }

  if (definition.outputSchemaRef !== "segment-script-draft") {
    throw new Error(
      `Skill ${definition.id} has unsupported outputSchemaRef: expected "segment-script-draft"`
    );
  }
};

const createManualReviewDecision = (segmentId: string): RepairDecision => ({
  segmentId,
  action: "manual_review",
  reason: "repair_depth_exceeded",
  retryable: false,
});

const createSemanticRetryDecision = (segmentId: string): RepairDecision => ({
  segmentId,
  action: "retry",
  reason: "semantic_retry",
  retryable: true,
});

const createInputRefinementDecision = (segmentId: string): RepairDecision => ({
  segmentId,
  action: "refine",
  reason: "input_refinement",
  retryable: true,
});

export const runSegmentRepairStageNative = async (
  input: RunSegmentRepairStageInput
): Promise<RunSegmentRepairStageResult> => {
  const runtimeAgentId = "repair-agent";
  const maxRepairDepth = input.maxRepairDepth ?? defaultMaxRepairDepth;

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

          if (input.failureKind === "semantic_retry") {
            return {
              status: "completed",
              output: {
                decision: createSemanticRetryDecision(input.segmentId),
                validationReport: input.validationReport,
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
          const skill = loadSkillDefinition(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          assertSkillCompatibleWithAgent(
            skill.definition.id,
            skill.definition.compatibleAgents,
            runtimeAgentId
          );
          assertSkillContract(skill.definition);
          const prompts = loadRepairPrompts(skillSource.skillDir);
          const context = buildAgentContext({
            agentId: runtimeAgentId,
            segmentText: input.segmentText,
            failedArtifact: input.failedArtifact,
            budget: {
              maxContextChars: 5000,
              reservedOutputChars: 1200,
            },
          });

          if (context.executionContext.inputOverBudget) {
            return {
              status: "completed",
              output: {
                decision: createInputRefinementDecision(input.segmentId),
              },
            };
          }

          const adapter = await resolveAdapter(input.adapter);
          const agent = createRepairAgent({
            adapter,
            now: input.now,
          });
          const result = await agent.execute({
            segmentId: input.segmentId,
            segmentText:
              typeof context.inputContext.segmentText === "string"
                ? context.inputContext.segmentText
                : "",
            failedArtifact: context.inputContext.failedArtifact,
            prompts,
          });

          return {
            status: "completed",
            output: {
              skillId: skill.definition.id,
              decision: result.decision,
              repairedDraft: result.repairedDraft,
              provider: result.provider,
              model: result.model,
            },
          };
        },
      },
    },
    createId: input.createId ?? createRuntimeId,
    appendTrace: input.appendTrace ?? (async () => undefined),
    now: input.now,
    createStageRun: input.createStageRun ?? (async () => undefined),
    updateStageRun: input.updateStageRun,
    createAgentRun: input.createAgentRun,
    updateAgentRun: input.updateAgentRun,
    createToolCall: input.createToolCall,
    updateToolCall: input.updateToolCall,
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

  return {
    stageRunId: stageResult.id,
    agentRunId: stageResult.agent.runId,
    status: "completed",
    decision,
    artifact:
      decision.action === "retry" && repairedDraft
        ? {
            kind: "segment-script-draft",
            skillId,
            segmentScriptDraft: repairedDraft,
          }
        : undefined,
  };
};

const buildShadowInput = (
  input: RunSegmentRepairStageInput
): RunSegmentRepairStageInput => ({
  ...input,
  shadowMode: false,
  onShadowResult: undefined,
  createStageRun: undefined,
  updateStageRun: undefined,
  createAgentRun: undefined,
  updateAgentRun: undefined,
  createToolCall: undefined,
  updateToolCall: undefined,
  appendTrace: async () => undefined,
});

export const runSegmentRepairStage = async (
  input: RunSegmentRepairStageInput
): Promise<RunSegmentRepairStageResult> => {
  const runMastraSegmentRepairStage =
    input.runMastraSegmentRepairStage ??
    (
      await import("../../mastra/runtime/run-mastra-segment-repair")
    ).runMastraSegmentRepair;

  if (input.executor === "mastra") {
    return runMastraSegmentRepairStage(input);
  }

  if (input.shadowMode) {
    const nativePromise = runSegmentRepairStageNative(input);
    const shadowPromise = runMastraSegmentRepairStage(buildShadowInput(input));
    const [nativeResult, shadowResult] = await Promise.all([
      nativePromise,
      shadowPromise.catch(() => null),
    ]);
    if (shadowResult) {
      await input.onShadowResult?.(shadowResult);
    }

    return nativeResult;
  }

  return runSegmentRepairStageNative(input);
};
