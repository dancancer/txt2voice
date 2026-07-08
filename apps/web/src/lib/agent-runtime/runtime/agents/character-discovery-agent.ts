import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  CharacterMemory,
  MemoryPatch,
} from "../../context";
import { renderPromptTemplate } from "../prompt-template";
import { mapResponseToMemoryPatch } from "./character-discovery-agent-normalize";

export interface CharacterDiscoveryPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export interface CharacterDiscoveryAgentInput {
  segmentText: string;
  characterMemorySummary: string;
  existingCharacterMemory?: CharacterMemory;
  modelPolicy?: string;
  prompts: CharacterDiscoveryPrompts;
  renderedUserPrompt?: string;
}

export interface CharacterDiscoveryAgentResult {
  characterMemoryDraft: MemoryPatch;
  rawResponse: string;
  provider: string;
  model: string;
}

interface CharacterDiscoveryAgentDeps {
  adapter: LLMAdapter;
}

interface CharacterDiscoveryErrorContext {
  rawResponse: string;
  provider: string;
  model: string;
}

interface CharacterDiscoveryExecutionError extends Error {
  output?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
};


export const renderCharacterDiscoveryUserPrompt = (
  template: string,
  params: { segmentText: string; characterMemorySummary: string }
) =>
  renderPromptTemplate(template, {
    segment_text: params.segmentText,
    character_memory_summary: params.characterMemorySummary || "none",
  });

const asErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return "character_discovery_parse_failed";
};

const toCharacterDiscoveryError = (params: {
  error: unknown;
  context: CharacterDiscoveryErrorContext;
}): CharacterDiscoveryExecutionError => {
  const wrapped = new Error(
    asErrorMessage(params.error)
  ) as CharacterDiscoveryExecutionError;
  wrapped.output = {
    failedArtifact: {
      kind: "character-discovery-failure",
      rawResponse: params.context.rawResponse,
      provider: params.context.provider,
      model: params.context.model,
      message: wrapped.message,
    },
  };

  return wrapped;
};

export const createCharacterDiscoveryAgent = (
  deps: CharacterDiscoveryAgentDeps
) => ({
  async execute(
    input: CharacterDiscoveryAgentInput
  ): Promise<CharacterDiscoveryAgentResult> {
    const response = await deps.adapter.call({
      systemPrompt: input.prompts.systemPrompt,
      prompt:
        input.renderedUserPrompt ??
        renderCharacterDiscoveryUserPrompt(input.prompts.userPrompt, {
          segmentText: input.segmentText,
          characterMemorySummary: input.characterMemorySummary,
        }),
      modelPolicy: input.modelPolicy ?? "default",
      metadata: {
        source: "agent_runtime.character_discovery",
        stageId: "character_discovery",
      },
    });

    try {
      return {
        characterMemoryDraft: mapResponseToMemoryPatch({
          content: response.content,
          existingCharacterMemory: input.existingCharacterMemory,
        }),
        rawResponse: response.content,
        provider: response.provider,
        model: response.model,
      };
    } catch (error) {
      throw toCharacterDiscoveryError({
        error,
        context: {
          rawResponse: response.content,
          provider: response.provider,
          model: response.model,
        },
      });
    }
  },
});
