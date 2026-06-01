import type { LLMAdapter } from "../../adapters/llm-adapter";
import {
  buildAgentContext,
} from "../../context";
import { createCharacterDiscoveryAgent } from "../../runtime/agents/character-discovery-agent";
import { renderCharacterDiscoveryUserPrompt } from "../../runtime/agents/character-discovery-agent";
import { validateAgentContract } from "../../runtime/agent-contract";
import {
  composeRuntimeSystemPrompt,
  loadSkillRuntimeBundle,
} from "../../runtime/load-skill-runtime-bundle";
import {
  fitPromptToBudget,
  preservePromptValueEdges,
  resolvePromptBudgetLimit,
} from "../../runtime/prompt-budget";
import { runStage, type StageRunRecord } from "../../runtime/run-stage";
import {
  buildSkillMetadataSnapshot,
  type SkillMetadataSnapshot,
} from "../../runtime/script-production-runtime-helpers";
import { validateSkillContract } from "../../runtime/skill-contract";
import type { TraceDependencies } from "../../runtime/write-trace";
import type {
  CharacterDiscoveryArtifact,
  RunCharacterDiscoveryStageInput,
  RunCharacterDiscoveryStageResult,
} from "../../runtime/stages/run-character-discovery-stage";
import {
  createRuntimeId,
  defaultCharacterExtractionSkillId,
  reconcileCharacterMemoryDraft,
  resolveAdapter,
  resolveCharacterDiscoveryFailureState,
  resolveCharacterExtractionSkillSource,
  toMemoryPatch,
} from "./run-mastra-character-discovery-stage/helpers";

interface CharacterDiscoveryRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

export const runMastraCharacterDiscoveryStage = async (
  input: RunCharacterDiscoveryStageInput,
  deps: CharacterDiscoveryRuntimeDeps = {}
): Promise<RunCharacterDiscoveryStageResult> => {
  const runtimeAgentId = "character-discovery-agent";
  const promptBudget = {
    maxContextChars: 12000,
    reservedOutputChars: 3000,
  } as const;

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "character_discovery",
      agent: {
        id: runtimeAgentId,
        resolveFailure: ({ error }) => {
          return resolveCharacterDiscoveryFailureState(error);
        },
        execute: async () => {
          const skillSource = resolveCharacterExtractionSkillSource({
            workspaceRoot: input.workspaceRoot,
            skillDir: input.skillDir,
          });
          const skill = loadSkillRuntimeBundle(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          const agentContract = validateAgentContract({
            workspaceRoot: skillSource.workspaceRoot,
            agentSourceId: "character-discovery",
            stageId: "character_discovery",
            skill: skill.definition,
            registeredTools: [],
          });
          validateSkillContract({
            skill: skill.definition,
            agentId: runtimeAgentId,
            expectedContextRequirements: ["segment", "character_memory_summary"],
            expectedInputSchemaRef: "character-input",
            expectedOutputSchemaRef: "character-output",
          });
          const context = buildAgentContext({
            agentId: runtimeAgentId,
            segmentText: input.segmentText,
            fullBookText: input.fullBookText,
            characterMemory: input.characterMemory,
            budget: promptBudget,
          });
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
              character_memory_summary:
                context.referenceMemory.characterMemorySummary,
            },
            trimOrder: ["character_memory_summary", "segment_text"],
            renderPrompt: (variables) =>
              renderCharacterDiscoveryUserPrompt(skill.userPrompt, {
                segmentText: variables.segment_text,
                characterMemorySummary: variables.character_memory_summary,
              }),
          });
          const segmentTextWasTrimmed =
            promptBudgetResult.trimmedKeys.includes("segment_text") &&
            promptBudgetResult.variables.segment_text.length > 0;
          const segmentText =
            segmentTextWasTrimmed &&
            typeof context.inputContext.segmentText === "string"
              ? preservePromptValueEdges(
                  context.inputContext.segmentText,
                  promptBudgetResult.variables.segment_text.length
                )
              : promptBudgetResult.variables.segment_text;
          const renderedUserPrompt = segmentTextWasTrimmed
            ? renderCharacterDiscoveryUserPrompt(skill.userPrompt, {
                segmentText,
                characterMemorySummary:
                  promptBudgetResult.variables.character_memory_summary,
              })
            : promptBudgetResult.prompt;
          if (promptBudgetResult.overBudget) {
            throw new Error(
              "Input context over budget for character discovery stage"
            );
          }

          const adapter = await resolveAdapter(input.adapter);
          const agent = createCharacterDiscoveryAgent({ adapter });
          const result = await agent.execute({
            segmentText,
            characterMemorySummary:
              promptBudgetResult.variables.character_memory_summary,
            existingCharacterMemory: input.characterMemory,
            modelPolicy: skill.definition.modelPolicy!,
            renderedUserPrompt,
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
          const reconciledDraft = reconcileCharacterMemoryDraft(
            result.characterMemoryDraft,
            input.characterMemory
          );

          return {
            status: "completed",
            output: {
              skillId: skill.definition.id,
              skillMetadata,
              characterMemoryDraft: reconciledDraft,
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
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
      status: stageResult.status,
      error: stageResult.agent.error,
      failedArtifact: stageResult.agent.output?.failedArtifact,
    };
  }

  const memoryDraft = toMemoryPatch(stageResult.agent.output?.characterMemoryDraft);
  const skillId =
    typeof stageResult.agent.output?.skillId === "string"
      ? stageResult.agent.output.skillId
      : defaultCharacterExtractionSkillId;

  const artifact: CharacterDiscoveryArtifact = {
    kind: "character-memory-draft",
    skillId: skillId as "character-extraction",
    characterMemoryDraft: memoryDraft,
    skillMetadata: stageResult.agent.output
      ?.skillMetadata as SkillMetadataSnapshot | undefined,
  };

  return {
    stageRunId: stageResult.id,
    status: "completed",
    artifact,
  };
};
