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

interface CanonicalIdentityIndex {
  canonicalIdentities: CharacterCanonicalIdentity[];
  canonicalIdByName: Map<string, string>;
  canonicalIdByInputId: Map<string, string>;
  canonicalIdSet: Set<string>;
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

const buildCanonicalIdentityIndex = (value: unknown): CanonicalIdentityIndex => {
  if (!Array.isArray(value)) {
    return {
      canonicalIdentities: [],
      canonicalIdByName: new Map(),
      canonicalIdByInputId: new Map(),
      canonicalIdSet: new Set(),
    };
  }

  const canonicalIdByName = new Map<string, string>();
  const canonicalIdByInputId = new Map<string, string>();
  const canonicalIdentities: CharacterCanonicalIdentity[] = [];

  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      continue;
    }

    const name = asText(item.name) ?? asText(item.canonicalName);
    if (!name) {
      continue;
    }

    const existingId = canonicalIdByName.get(name);
    const inputId = asText(item.id);

    if (existingId) {
      if (inputId) {
        canonicalIdByInputId.set(inputId, existingId);
      }
      continue;
    }

    const canonicalId = inputId ?? toCanonicalId(name, index);
    canonicalIdByName.set(name, canonicalId);
    canonicalIdByInputId.set(canonicalId, canonicalId);
    if (inputId) {
      canonicalIdByInputId.set(inputId, canonicalId);
    }
    canonicalIdentities.push({ id: canonicalId, name });
  }

  return {
    canonicalIdentities,
    canonicalIdByName,
    canonicalIdByInputId,
    canonicalIdSet: new Set(canonicalIdentities.map((item) => item.id)),
  };
};

const resolveCanonicalId = (
  rawKey: string,
  index: CanonicalIdentityIndex
): string | null => {
  const key = rawKey.trim();
  if (!key) {
    return null;
  }

  const byName = index.canonicalIdByName.get(key);
  if (byName) {
    return byName;
  }

  const byInputId = index.canonicalIdByInputId.get(key);
  if (byInputId) {
    return byInputId;
  }

  if (index.canonicalIdSet.has(key)) {
    return key;
  }

  return null;
};

const normalizeAliasEvidence = (
  value: unknown,
  index: CanonicalIdentityIndex
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
      resolveCanonicalId(asText(item.canonicalId) ?? "", index) ??
      resolveCanonicalId(asText(item.canonicalName) ?? "", index);
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
  index: CanonicalIdentityIndex
): Record<string, unknown> => {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const canonicalId = resolveCanonicalId(rawKey, index);
    if (!canonicalId) {
      continue;
    }

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

  throw new Error("Invalid character discovery payload: expected JSON object");
};

const mapResponseToMemoryPatch = (content: string): MemoryPatch => {
  const payload = extractJsonPayload(content);
  const identityIndex = buildCanonicalIdentityIndex(payload.canonicalIdentities);

  return {
    canonicalIdentities: identityIndex.canonicalIdentities,
    aliasEvidence: normalizeAliasEvidence(payload.aliasEvidence, identityIndex),
    assertedFacts: normalizeFactBucket(payload.assertedFacts, identityIndex),
    inferredHints: normalizeFactBucket(payload.inferredHints, identityIndex),
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
