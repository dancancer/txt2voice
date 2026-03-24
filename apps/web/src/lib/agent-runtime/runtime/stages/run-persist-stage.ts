import { buildCharacterMap } from "@/lib/script-generator/storage/character-utils";
import type { CharacterMemory, MemoryPatch, SegmentScriptDraft } from "../../context";
import { createPersistTools, type PersistTools } from "../../tools/persist-tools";
import { runStage, type StageRunRecord } from "../run-stage";
import type { TraceDependencies } from "../write-trace";

interface PersistRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
}

interface CharacterProfileLike {
  id?: string;
  canonicalName?: string;
  aliases?: Array<{ alias: string }>;
}

export type PersistStageArtifactInput =
  | {
      kind: "character-memory-draft";
      characterMemory: CharacterMemory | MemoryPatch;
    }
  | {
      kind: "segment-script-draft";
      segmentScriptDraft: SegmentScriptDraft;
      chapterId?: string | null;
    };

export interface RunPersistStageInput extends PersistRuntimeDeps {
  workflowRunId: string;
  bookId: string;
  artifacts: PersistStageArtifactInput[];
  tools?: PersistTools;
  characterProfiles?: CharacterProfileLike[];
  characterMap?: Map<string, string>;
}

export interface PersistStageArtifact {
  kind: "persisted-business-facts";
  persistedCharacterCount: number;
  persistedSentenceCount: number;
}

interface RunPersistStageCompletedResult {
  stageRunId: string;
  status: "completed";
  artifact: PersistStageArtifact;
}

interface RunPersistStageNonCompletedResult {
  stageRunId: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
}

export type RunPersistStageResult =
  | RunPersistStageCompletedResult
  | RunPersistStageNonCompletedResult;

const ARTIFACT_KIND_PRIORITY: Record<PersistStageArtifactInput["kind"], number> = {
  "character-memory-draft": 0,
  "segment-script-draft": 1,
};

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const toCharacterMemory = (
  value: CharacterMemory | MemoryPatch
): CharacterMemory => ({
  canonicalIdentities: Array.isArray(value.canonicalIdentities)
    ? value.canonicalIdentities
    : [],
  aliasEvidence: Array.isArray(value.aliasEvidence) ? value.aliasEvidence : [],
  assertedFacts:
    value.assertedFacts &&
    typeof value.assertedFacts === "object" &&
    !Array.isArray(value.assertedFacts)
      ? value.assertedFacts
      : {},
  inferredHints:
    value.inferredHints &&
    typeof value.inferredHints === "object" &&
    !Array.isArray(value.inferredHints)
      ? value.inferredHints
      : {},
});

const sortPersistArtifacts = (
  artifacts: PersistStageArtifactInput[]
): PersistStageArtifactInput[] =>
  artifacts
    .map((artifact, index) => ({ artifact, index }))
    .sort((left, right) => {
      const priorityDiff =
        ARTIFACT_KIND_PRIORITY[left.artifact.kind] -
        ARTIFACT_KIND_PRIORITY[right.artifact.kind];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return left.index - right.index;
    })
    .map((item) => item.artifact);

export const runPersistStage = async (
  input: RunPersistStageInput
): Promise<RunPersistStageResult> => {
  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "persist",
      agent: {
        id: "persist-agent",
        execute: async () => {
          const tools = input.tools || createPersistTools();
          const characterProfiles = input.characterProfiles || [];
          const characterMap =
            input.characterMap || buildCharacterMap(characterProfiles);

          let persistedCharacterCount = 0;
          let persistedSentenceCount = 0;

          for (const artifact of sortPersistArtifacts(input.artifacts)) {
            if (artifact.kind === "character-memory-draft") {
              const result = await tools.persistCharacterMemoryDraft({
                bookId: input.bookId,
                characterMemory: toCharacterMemory(artifact.characterMemory),
                characterProfiles,
                characterMap,
              });
              persistedCharacterCount += result.persistedCharacterCount;
              continue;
            }

            const result = await tools.persistSegmentScriptDraft({
              bookId: input.bookId,
              segmentScriptDraft: artifact.segmentScriptDraft,
              chapterId: artifact.chapterId,
              characterProfiles,
              characterMap,
            });
            persistedSentenceCount += result.persistedSentenceCount;
          }

          return {
            status: "completed",
            output: {
              persistedCharacterCount,
              persistedSentenceCount,
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
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
      status: stageResult.status,
      error: stageResult.agent.error,
    };
  }

  return {
    stageRunId: stageResult.id,
    status: "completed",
    artifact: {
      kind: "persisted-business-facts",
      persistedCharacterCount:
        typeof stageResult.agent.output?.persistedCharacterCount === "number"
          ? stageResult.agent.output.persistedCharacterCount
          : 0,
      persistedSentenceCount:
        typeof stageResult.agent.output?.persistedSentenceCount === "number"
          ? stageResult.agent.output.persistedSentenceCount
          : 0,
    },
  };
};
