import type { SegmentScriptDraft, ValidationReport } from "../context";
import {
  createWorkflowRuntimeState,
  setCanonicalizedDraft,
  setCurrentDraft,
  setCurrentSegment,
  setFailedArtifact,
  setValidationReport,
} from "../runtime/script-production/runtime-state";

describe("workflow runtime state", () => {
  it("initializes workflow state from book and profiles", () => {
    const state = createWorkflowRuntimeState({
      workflowRunId: "workflow-1",
      bookId: "book-1",
      characterProfiles: [
        {
          id: "char-ning",
          canonicalName: "宁尘",
          aliases: [{ alias: "宁公子" }],
        },
      ],
    });

    expect(state.workflowRunId).toBe("workflow-1");
    expect(state.bookId).toBe("book-1");
    expect(state.characterMemory.version).toBe(1);
    expect(state.characterMemory.canonicalIdentities).toEqual([
      { id: "char-ning", name: "宁尘" },
    ]);
    expect(state.characterMap.get("宁尘")).toBe("宁尘");
    expect(state.characterMap.get("宁公子")).toBe("宁尘");
    expect(state.currentSegment).toBeUndefined();
    expect(state.currentDraft).toBeUndefined();
    expect(state.canonicalizedDraft).toBeUndefined();
    expect(state.validationReport).toBeUndefined();
    expect(state.failedArtifact).toBeUndefined();
    expect(state.degradedMode).toBe(false);
    expect(state.workflowIssues).toEqual([]);
  });

  it("updates current segment without mutating character memory state", () => {
    const initial = createWorkflowRuntimeState({
      workflowRunId: "workflow-2",
      bookId: "book-2",
      characterProfiles: [
        {
          id: "char-long",
          canonicalName: "龙雅歌",
          aliases: [{ alias: "宫主" }],
        },
      ],
    });

    const next = setCurrentSegment(initial, {
      segmentId: "segment-1",
      chapterId: "chapter-1",
      orderIndex: 0,
      sourceText: "龙雅歌抬眸。",
    });

    expect(next.currentSegment).toEqual({
      segmentId: "segment-1",
      chapterId: "chapter-1",
      orderIndex: 0,
      sourceText: "龙雅歌抬眸。",
    });
    expect(next.characterMemory).toEqual(initial.characterMemory);
    expect(next.characterProfiles).toEqual(initial.characterProfiles);
    expect(next.characterMap.get("宫主")).toBe("龙雅歌");
    expect(next.currentDraft).toBeUndefined();
  });

  it("stores draft, canonicalized draft, validation report and failed artifact in dedicated slots", () => {
    const initial = createWorkflowRuntimeState({
      workflowRunId: "workflow-3",
      bookId: "book-3",
      characterProfiles: [],
    });
    const currentDraft: SegmentScriptDraft = {
      segmentId: "segment-3",
      createdAt: "2026-04-09T00:00:00.000Z",
      lines: [
        {
          id: "line-1",
          sourceText: "宁公子抱拳。",
          text: "宁公子抱拳。",
          speaker: "宁公子",
          orderInSegment: 0,
        },
      ],
    };
    const canonicalizedDraft: SegmentScriptDraft = {
      ...currentDraft,
      lines: [
        {
          ...currentDraft.lines[0]!,
          speaker: "宁尘",
        },
      ],
    };
    const validationReport: ValidationReport = {
      segmentId: "segment-3",
      valid: true,
      coverageRatio: 1,
      issues: [],
    };
    const failedArtifact = {
      kind: "segment-scripting-failure",
      message: "bad_json",
    };

    const withDraft = setCurrentDraft(initial, currentDraft);
    const withCanonicalizedDraft = setCanonicalizedDraft(
      withDraft,
      canonicalizedDraft
    );
    const withValidation = setValidationReport(
      withCanonicalizedDraft,
      validationReport
    );
    const final = setFailedArtifact(withValidation, failedArtifact);

    expect(final.currentDraft).toEqual(currentDraft);
    expect(final.canonicalizedDraft).toEqual(canonicalizedDraft);
    expect(final.validationReport).toEqual(validationReport);
    expect(final.failedArtifact).toEqual(failedArtifact);
    expect(final.currentDraft?.lines[0]?.speaker).toBe("宁公子");
    expect(final.canonicalizedDraft?.lines[0]?.speaker).toBe("宁尘");
  });
});
