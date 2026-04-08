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

  const aliasMap = new Map<string, string[]>();
  for (const evidence of memory.aliasEvidence) {
    const bucket = aliasMap.get(evidence.canonicalId) || [];
    if (!bucket.includes(evidence.alias)) {
      bucket.push(evidence.alias);
      aliasMap.set(evidence.canonicalId, bucket);
    }
  }

  const characters = memory.canonicalIdentities.map((identity) => ({
    id: identity.id,
    name: identity.name,
    aliases: aliasMap.get(identity.id) || [],
    assertedFacts: memory.assertedFacts[identity.id] ?? {},
    inferredHints: memory.inferredHints[identity.id] ?? {},
  }));

  return JSON.stringify({ characters });
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
