import { writeTrace } from "../runtime/write-trace";

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
});
