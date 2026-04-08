import type { CharacterMemory } from "./memory-types";
import { applyReferenceMemoryBudget, type ContextBudget } from "./budget-policy";

export type SupportedAgentId =
  | "script-generation-agent"
  | "character-discovery-agent"
  | "repair-agent";

export interface BuildAgentContextInput {
  agentId: SupportedAgentId;
  segmentText?: string;
  fullBookText?: string;
  failedArtifact?: unknown;
  characterMemory?: CharacterMemory;
  workingMemory?: Record<string, unknown>;
  policyContext?: Record<string, unknown>;
  budget: ContextBudget;
}

export interface AgentExecutionContext {
  inputContext: {
    segmentText?: string;
    failedArtifact?: unknown;
  };
  workingMemory: Record<string, unknown>;
  referenceMemory: {
    characterMemorySummary: string;
  };
  policyContext: Record<string, unknown>;
  executionContext: {
    agentId: SupportedAgentId;
    maxContextChars: number;
    reservedOutputChars: number;
    inputContextChars: number;
    remainingReferenceChars: number;
    inputOverBudget: boolean;
  };
}

const summarizeCharacterMemory = (memory?: CharacterMemory): string => {
  if (!memory) {
    return "";
  }

  const names = memory.canonicalIdentities.map((item) => item.name).join(", ");
  const aliases = memory.aliasEvidence.map((item) => item.alias).join(", ");
  const aliasCount = memory.aliasEvidence.length;
  const assertedCount = Object.keys(memory.assertedFacts).length;
  const inferredCount = Object.keys(memory.inferredHints).length;

  return [
    `names:${names}`,
    `aliases:${aliases}`,
    `aliasCount:${aliasCount}`,
    `assertedCount:${assertedCount}`,
    `inferredCount:${inferredCount}`,
  ].join(" | ");
};

const buildInputContext = (
  input: BuildAgentContextInput
): AgentExecutionContext["inputContext"] => {
  if (input.agentId === "repair-agent") {
    return {
      ...(input.segmentText ? { segmentText: input.segmentText } : {}),
      failedArtifact: input.failedArtifact ?? null,
    };
  }

  return {
    segmentText: input.segmentText || "",
  };
};

export const buildAgentContext = (
  input: BuildAgentContextInput
): AgentExecutionContext => {
  const inputContext = buildInputContext(input);
  const inputContextChars = JSON.stringify(inputContext).length;
  const referenceCandidate = summarizeCharacterMemory(input.characterMemory);
  const budgetResult = applyReferenceMemoryBudget({
    budget: input.budget,
    inputContextChars,
    referenceCandidate,
  });

  return {
    inputContext,
    workingMemory: input.workingMemory || {},
    referenceMemory: {
      characterMemorySummary: budgetResult.trimmedReferenceMemory,
    },
    policyContext: input.policyContext || {},
    executionContext: {
      agentId: input.agentId,
      maxContextChars: input.budget.maxContextChars,
      reservedOutputChars: input.budget.reservedOutputChars,
      inputContextChars,
      remainingReferenceChars: budgetResult.remainingReferenceChars,
      inputOverBudget: budgetResult.inputOverBudget,
    },
  };
};
