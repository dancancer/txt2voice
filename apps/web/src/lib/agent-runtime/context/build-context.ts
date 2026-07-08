import type { CharacterMemory } from "./memory-types";
import { applyReferenceMemoryBudget, type ContextBudget } from "./budget-policy";

export type SupportedAgentId =
  | "script-generation-agent"
  | "character-discovery-agent"
  | "repair-agent"
  | "quality-judge-agent";

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

const scoreCharacterRelevance = (params: {
  segmentText: string;
  canonicalName: string;
  aliases: string[];
}): number => {
  const segmentText = params.segmentText.trim();
  if (!segmentText) {
    return 0;
  }

  if (params.canonicalName && segmentText.includes(params.canonicalName)) {
    return 3;
  }

  if (params.aliases.some((alias) => alias && segmentText.includes(alias))) {
    return 2;
  }

  return 0;
};

const summarizeCharacterMemory = (
  memory?: CharacterMemory,
  segmentText = ""
): string => {
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

  const characters = memory.canonicalIdentities
    .map((identity, index) => {
      const aliases = aliasMap.get(identity.id) || [];
      return {
        id: identity.id,
        name: identity.name,
        aliases,
        assertedFacts: memory.assertedFacts[identity.id] ?? {},
        inferredHints: memory.inferredHints[identity.id] ?? {},
        relevanceScore: scoreCharacterRelevance({
          segmentText,
          canonicalName: identity.name,
          aliases,
        }),
        originalIndex: index,
      };
    })
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ relevanceScore: _relevanceScore, originalIndex: _originalIndex, ...character }) => character);

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
  const referenceCandidate = summarizeCharacterMemory(
    input.characterMemory,
    input.segmentText || ""
  );
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
