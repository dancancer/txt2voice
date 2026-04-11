import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import {
  buildAgentContext,
  type SegmentScriptDraft,
} from "../../context";
import {
  createScriptGenerationAgent,
  renderScriptGenerationUserPrompt,
} from "../../runtime/agents/script-generation-agent";
import {
  createCharacterMemorySnapshot,
} from "../../runtime/character-memory/store";
import { validateAgentContract } from "../../runtime/agent-contract";
import {
  composeRuntimeSystemPrompt,
  loadSkillRuntimeBundle,
} from "../../runtime/load-skill-runtime-bundle";
import { fitPromptToBudget, resolvePromptBudgetLimit } from "../../runtime/prompt-budget";
import type { AgentRunRecord } from "../../runtime/run-agent";
import { runStage, type StageRunRecord } from "../../runtime/run-stage";
import {
  buildSkillMetadataSnapshot,
  type SkillMetadataSnapshot,
} from "../../runtime/script-production-runtime-helpers";
import { validateSkillContract } from "../../runtime/skill-contract";
import type { TraceDependencies } from "../../runtime/write-trace";
import type {
  RunSegmentScriptingStageInput,
  RunSegmentScriptingStageResult,
  SegmentScriptingArtifact,
} from "../../runtime/stages/run-segment-scripting-stage";

interface SegmentScriptingRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

interface ScriptGenerationSkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

const defaultScriptGenerationSkillId = "script-generation";

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

const resolveScriptGenerationSkillSource = (params: {
  workspaceRoot?: string;
  skillDir?: string;
}): ScriptGenerationSkillSource => {
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
    skillId: defaultScriptGenerationSkillId,
    skillDir: path.join(workspaceRoot, "skills", defaultScriptGenerationSkillId),
  };
};

const resolveAdapter = async (adapter?: LLMAdapter): Promise<LLMAdapter> => {
  if (adapter) {
    return adapter;
  }

  const { createDefaultLLMAdapter } = await import("../../adapters/llm-adapter");
  return createDefaultLLMAdapter();
};

const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown stage execution error";
};

const isRepairableError = (message: string): boolean =>
  message.startsWith("Invalid script generation payload") ||
  message.startsWith("Invalid script line") ||
  message.startsWith("Input context over budget");

export const runMastraSegmentScriptingStage = async (
  input: RunSegmentScriptingStageInput,
  deps: SegmentScriptingRuntimeDeps = {}
): Promise<RunSegmentScriptingStageResult> => {
  const runtimeAgentId = "script-generation-agent";
  const promptBudget = {
    maxContextChars: 4000,
    reservedOutputChars: 1200,
  } as const;

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "segment_scripting",
      agent: {
        id: runtimeAgentId,
        inputSummary: {
          segmentId: input.segmentId,
          sourceLength: input.segmentText.length,
        },
        resolveFailure: ({ error }) => {
          const message = asErrorMessage(error);
          return isRepairableError(message) ? "repairing" : "failed";
        },
        execute: async () => {
          const skillSource = resolveScriptGenerationSkillSource({
            workspaceRoot: input.workspaceRoot,
            skillDir: input.skillDir,
          });
          const skill = loadSkillRuntimeBundle(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          const agentContract = validateAgentContract({
            workspaceRoot: skillSource.workspaceRoot,
            agentSourceId: "script-generation",
            stageId: "segment_scripting",
            skill: skill.definition,
            registeredTools: [],
          });
          validateSkillContract({
            skill: skill.definition,
            agentId: runtimeAgentId,
            expectedContextRequirements: ["segment", "character_memory_summary"],
            expectedOutputSchemaRef: "segment-script-draft",
          });
          const context = buildAgentContext({
            agentId: runtimeAgentId,
            segmentText: input.segmentText,
            fullBookText: input.fullBookText,
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
          if (context.executionContext.inputOverBudget) {
            throw new Error("Input context over budget for segment scripting stage");
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
              character_memory_summary: characterMemorySummary,
            },
            trimOrder: ["character_memory_summary", "segment_text"],
            renderPrompt: (variables) =>
              renderScriptGenerationUserPrompt(skill.userPrompt, {
                segmentText: variables.segment_text,
                characterMemorySummary: variables.character_memory_summary,
              }),
          });
          if (
            promptBudgetResult.overBudget ||
            promptBudgetResult.trimmedKeys.includes("segment_text")
          ) {
            throw new Error("Input context over budget for segment scripting stage");
          }

          const adapter = await resolveAdapter(input.adapter);
          const agent = createScriptGenerationAgent({
            adapter,
            now: deps.now ?? input.now,
          });
          const result = await agent.execute({
            segmentId: input.segmentId,
            segmentText: promptBudgetResult.variables.segment_text,
            characterMemorySummary:
              promptBudgetResult.variables.character_memory_summary,
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
              memoryVersion: memorySnapshot?.version,
              segmentScriptDraft: result.segmentScriptDraft,
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

  const skillId =
    typeof stageResult.agent.output?.skillId === "string"
      ? stageResult.agent.output.skillId
      : defaultScriptGenerationSkillId;
  const segmentScriptDraft = stageResult.agent
    .output?.segmentScriptDraft as SegmentScriptDraft;

  const artifact: SegmentScriptingArtifact = {
    kind: "segment-script-draft",
    skillId,
    segmentScriptDraft,
    memoryVersion:
      typeof stageResult.agent.output?.memoryVersion === "number"
        ? stageResult.agent.output.memoryVersion
        : undefined,
    skillMetadata: stageResult.agent.output
      ?.skillMetadata as SkillMetadataSnapshot | undefined,
  };

  return {
    stageRunId: stageResult.id,
    agentRunId: stageResult.agent.runId,
    status: "completed",
    artifact,
  };
};
