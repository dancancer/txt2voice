import { writeTrace } from "../runtime/write-trace";
import {
  EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
  EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
  EVENT_KIND_SPEAKER_CANONICALIZED,
} from "../protocol/events";

describe("writeTrace", () => {
  it("maps blocked and manual_review_required statuses to terminal event statuses", async () => {
    const appendTrace = jest.fn();

    const blocked = await writeTrace({
      appendTrace,
      createId: () => "trace-blocked",
      workflowRunId: "wf-1",
      kind: "workflow.blocked",
      status: "blocked",
    });
    const manualReview = await writeTrace({
      appendTrace,
      createId: () => "trace-review",
      workflowRunId: "wf-1",
      kind: "workflow.manual_review_required",
      status: "manual_review_required",
    });

    expect(blocked.status).toBe("failed");
    expect(manualReview.status).toBe("completed");
  });

  it("normalizes legacy validation event names before appending", async () => {
    const appendTrace = jest.fn();

    const event = await writeTrace({
      appendTrace,
      createId: () => "trace-validation",
      workflowRunId: "wf-1",
      kind: "validation.failed",
      status: "failed",
      payload: {
        segmentId: "seg-1",
      },
    });

    expect(event.kind).toBe("validation_failed");
    expect(appendTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "validation_failed",
        payload: expect.objectContaining({
          segmentId: "seg-1",
        }),
      })
    );
  });

  it("preserves skill metadata payloads for downstream observability", async () => {
    const appendTrace = jest.fn();

    const event = await writeTrace({
      appendTrace,
      createId: () => "trace-skill-metadata",
      workflowRunId: "wf-1",
      stageRunId: "stage-1",
      agentRunId: "agent-1",
      kind: "skill_selected",
      status: "completed",
      payload: {
        skillId: "script-generation",
        skillMetadata: {
          promptFingerprint: "prompts/system.md|prompts/user.md",
          modelPolicy: "balanced",
          repairPolicy: "handoff-to-json-repair",
          successCriteria: ["returns-segment-script-draft"],
          telemetryTags: ["runtime", "segment-scripting"],
        },
      },
    });

    expect(event.payload).toEqual(
      expect.objectContaining({
        skillMetadata: expect.objectContaining({
          modelPolicy: "balanced",
          repairPolicy: "handoff-to-json-repair",
          telemetryTags: ["runtime", "segment-scripting"],
        }),
      })
    );
    expect(appendTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          skillMetadata: expect.objectContaining({
            promptFingerprint: "prompts/system.md|prompts/user.md",
          }),
        }),
      })
    );
  });

  it("passes through character memory lifecycle and speaker normalization events unchanged", async () => {
    const appendTrace = jest.fn();

    const bootstrapped = await writeTrace({
      appendTrace,
      createId: () => "trace-memory-bootstrapped",
      workflowRunId: "wf-1",
      kind: EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
      status: "completed",
      payload: {
        memoryVersion: 1,
      },
    });
    const canonicalized = await writeTrace({
      appendTrace,
      createId: () => "trace-speaker-canonicalized",
      workflowRunId: "wf-1",
      kind: EVENT_KIND_SPEAKER_CANONICALIZED,
      status: "completed",
      payload: {
        raw: "宁公子",
        canonical: "宁采臣",
      },
    });
    const refreshFailed = await writeTrace({
      appendTrace,
      createId: () => "trace-memory-refresh-failed",
      workflowRunId: "wf-1",
      kind: EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
      status: "failed",
      payload: {
        error: "llm_unavailable",
      },
    });

    expect(bootstrapped.kind).toBe("character_memory_bootstrapped");
    expect(canonicalized.kind).toBe("speaker_canonicalized");
    expect(refreshFailed.kind).toBe("character_memory_refresh_failed");
    expect(appendTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "speaker_canonicalized",
        payload: expect.objectContaining({
          raw: "宁公子",
          canonical: "宁采臣",
        }),
      })
    );
  });
});
