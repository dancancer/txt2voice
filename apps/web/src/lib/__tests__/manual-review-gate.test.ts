import { classifyManualReviewItem } from "@/lib/auto-pipeline/manual-review-gate";

describe("manual review gate", () => {
  it("blocks pending and reprocessing items", () => {
    expect(
      classifyManualReviewItem({
        status: "pending",
        resolutionType: null,
        issueType: "MISSING_AUDIO",
        issueDetail: { blockingReason: "missing_audio" },
      }).blocking
    ).toBe(true);
    expect(
      classifyManualReviewItem({
        status: "reprocessing",
        resolutionType: "retry_requested",
        issueDetail: {},
      }).blocking
    ).toBe(true);
  });

  it("does not block resolved non-blocking resolutions", () => {
    expect(
      classifyManualReviewItem({
        status: "resolved",
        resolutionType: "fixed",
        issueDetail: {},
      }).blocking
    ).toBe(false);
  });

  it("blocks rejected hard failures", () => {
    expect(
      classifyManualReviewItem({
        status: "rejected",
        resolutionType: "hard_failure",
        issueDetail: { recoveryExhausted: true },
      }).blocking
    ).toBe(true);
  });
});
