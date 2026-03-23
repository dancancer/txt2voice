import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  CharacterAliasEvidence,
  CharacterCanonicalIdentity,
  MemoryPatch,
} from "../../context";

export interface CharacterDiscoveryPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export interface CharacterDiscoveryAgentInput {
  segmentText: string;
  characterMemorySummary: string;
  prompts: CharacterDiscoveryPrompts;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
};

const toCanonicalId = (name: string, index: number): string => {
  const slug = name
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `char-${slug}` : `char-${index + 1}`;
};

const normalizeCanonicalIdentities = (
  value: unknown
): CharacterCanonicalIdentity[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Map<string, CharacterCanonicalIdentity>();

  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      continue;
    }

    const name = asText(item.name) ?? asText(item.canonicalName);
    if (!name) {
      continue;
    }

    const id = asText(item.id) ?? toCanonicalId(name, index);
    normalized.set(id, { id, name });
  }

  return [...normalized.values()];
};

const normalizeAliasEvidence = (
  value: unknown,
  canonicalIdByName: Map<string, string>
): CharacterAliasEvidence[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedupe = new Set<string>();
  const normalized: CharacterAliasEvidence[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const alias = asText(item.alias);
    if (!alias) {
      continue;
    }

    const canonicalId =
      asText(item.canonicalId) ??
      canonicalIdByName.get(asText(item.canonicalName) ?? "") ??
      null;
    if (!canonicalId) {
      continue;
    }

    const source = asText(item.source) ?? "llm";
    const key = `${alias}::${canonicalId}::${source}`;

    if (dedupe.has(key)) {
      continue;
    }

    dedupe.add(key);
    normalized.push({ alias, canonicalId, source });
  }

  return normalized;
};

const normalizeFactBucket = (
  value: unknown,
  canonicalIdByName: Map<string, string>
): Record<string, unknown> => {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }

    const canonicalId = canonicalIdByName.get(key) ?? key;
    normalized[canonicalId] = rawValue;
  }

  return normalized;
};

const parseObject = (rawText: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(rawText);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractJsonPayload = (content: string): Record<string, unknown> => {
  const direct = parseObject(content);
  if (direct) {
    return direct;
  }

  const fencedBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedBlock?.[1]) {
    const fromFence = parseObject(fencedBlock[1]);
    if (fromFence) {
      return fromFence;
    }
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const fromBraces = parseObject(content.slice(start, end + 1));
    if (fromBraces) {
      return fromBraces;
    }
  }

  return {};
};

const mapResponseToMemoryPatch = (content: string): MemoryPatch => {
  const payload = extractJsonPayload(content);
  const canonicalIdentities = normalizeCanonicalIdentities(
    payload.canonicalIdentities
  );
  const canonicalIdByName = new Map(
    canonicalIdentities.map((identity) => [identity.name, identity.id])
  );

  return {
    canonicalIdentities,
    aliasEvidence: normalizeAliasEvidence(
      payload.aliasEvidence,
      canonicalIdByName
    ),
    assertedFacts: normalizeFactBucket(payload.assertedFacts, canonicalIdByName),
    inferredHints: normalizeFactBucket(payload.inferredHints, canonicalIdByName),
  };
};

const renderUserPrompt = (
  template: string,
  params: { segmentText: string; characterMemorySummary: string }
) =>
  template
    .replaceAll("{{segment_text}}", params.segmentText)
    .replaceAll(
      "{{character_memory_summary}}",
      params.characterMemorySummary || "none"
    );

export const createCharacterDiscoveryAgent = (
  deps: CharacterDiscoveryAgentDeps
) => ({
  async execute(
    input: CharacterDiscoveryAgentInput
  ): Promise<CharacterDiscoveryAgentResult> {
    const response = await deps.adapter.call({
      systemPrompt: input.prompts.systemPrompt,
      prompt: renderUserPrompt(input.prompts.userPrompt, {
        segmentText: input.segmentText,
        characterMemorySummary: input.characterMemorySummary,
      }),
      metadata: {
        source: "agent_runtime.character_discovery",
        stageId: "character_discovery",
      },
    });

    return {
      characterMemoryDraft: mapResponseToMemoryPatch(response.content),
      rawResponse: response.content,
      provider: response.provider,
      model: response.model,
    };
  },
});
