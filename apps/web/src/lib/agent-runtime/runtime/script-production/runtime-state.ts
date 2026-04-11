import type { SegmentScriptDraft, ValidationReport } from "../../context";
import { createBootstrapCharacterMemorySnapshot } from "../character-memory/store";
import type { CharacterMemorySnapshot } from "../character-memory/types";
import { buildCharacterMap } from "./storage/character-utils";
import type {
  CharacterProfileSnapshot,
  RuntimeSegmentState,
} from "./shared-types";

export interface WorkflowRuntimeIssue {
  code: string;
  stage: string;
  message: string;
  retryable?: boolean;
}

export interface WorkflowRuntimeState {
  workflowRunId: string;
  bookId: string;
  characterMemory: CharacterMemorySnapshot;
  characterProfiles: CharacterProfileSnapshot[];
  characterMap: Map<string, string>;
  currentSegment?: RuntimeSegmentState;
  currentDraft?: SegmentScriptDraft;
  canonicalizedDraft?: SegmentScriptDraft;
  validationReport?: ValidationReport;
  failedArtifact?: unknown;
  degradedMode: boolean;
  workflowIssues: WorkflowRuntimeIssue[];
}

interface CreateWorkflowRuntimeStateInput {
  workflowRunId: string;
  bookId: string;
  characterProfiles: CharacterProfileSnapshot[];
  now?: () => Date;
}

const cloneCharacterMap = (value: Map<string, string>): Map<string, string> =>
  new Map(value);

const cloneWorkflowIssues = (
  value: WorkflowRuntimeIssue[]
): WorkflowRuntimeIssue[] => value.map((issue) => ({ ...issue }));

const cloneState = (
  state: WorkflowRuntimeState
): WorkflowRuntimeState => ({
  ...state,
  characterProfiles: [...state.characterProfiles],
  characterMap: cloneCharacterMap(state.characterMap),
  workflowIssues: cloneWorkflowIssues(state.workflowIssues),
});

export const createWorkflowRuntimeState = (
  input: CreateWorkflowRuntimeStateInput
): WorkflowRuntimeState => {
  const characterProfiles = [...input.characterProfiles];

  return {
    workflowRunId: input.workflowRunId,
    bookId: input.bookId,
    characterMemory: createBootstrapCharacterMemorySnapshot(
      characterProfiles,
      input.now
    ),
    characterProfiles,
    characterMap: buildCharacterMap(characterProfiles),
    degradedMode: false,
    workflowIssues: [],
  };
};

export const setCurrentSegment = (
  state: WorkflowRuntimeState,
  currentSegment: RuntimeSegmentState
): WorkflowRuntimeState => ({
  ...cloneState(state),
  currentSegment: { ...currentSegment },
});

export const setCurrentDraft = (
  state: WorkflowRuntimeState,
  currentDraft: SegmentScriptDraft | undefined
): WorkflowRuntimeState => ({
  ...cloneState(state),
  currentDraft,
});

export const setCanonicalizedDraft = (
  state: WorkflowRuntimeState,
  canonicalizedDraft: SegmentScriptDraft | undefined
): WorkflowRuntimeState => ({
  ...cloneState(state),
  canonicalizedDraft,
});

export const setValidationReport = (
  state: WorkflowRuntimeState,
  validationReport: ValidationReport | undefined
): WorkflowRuntimeState => ({
  ...cloneState(state),
  validationReport,
});

export const setFailedArtifact = (
  state: WorkflowRuntimeState,
  failedArtifact: unknown
): WorkflowRuntimeState => ({
  ...cloneState(state),
  failedArtifact,
});

export const updateCharacterMemoryState = (
  state: WorkflowRuntimeState,
  params: {
    characterMemory: CharacterMemorySnapshot;
    characterProfiles?: CharacterProfileSnapshot[];
    characterMap?: Map<string, string>;
  }
): WorkflowRuntimeState => ({
  ...cloneState(state),
  characterMemory: params.characterMemory,
  characterProfiles: params.characterProfiles
    ? [...params.characterProfiles]
    : [...state.characterProfiles],
  characterMap: params.characterMap
    ? cloneCharacterMap(params.characterMap)
    : cloneCharacterMap(state.characterMap),
});

export const setDegradedMode = (
  state: WorkflowRuntimeState,
  degradedMode: boolean
): WorkflowRuntimeState => ({
  ...cloneState(state),
  degradedMode,
});

export const appendWorkflowIssue = (
  state: WorkflowRuntimeState,
  issue: WorkflowRuntimeIssue
): WorkflowRuntimeState => ({
  ...cloneState(state),
  workflowIssues: [...state.workflowIssues, { ...issue }],
});
