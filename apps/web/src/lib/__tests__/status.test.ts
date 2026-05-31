import { getBookStatusMeta } from "@/lib/status";

describe("book status metadata", () => {
  it("defines audio_review_ready explicitly", () => {
    expect(getBookStatusMeta("audio_review_ready")).toMatchObject({
      label: "音频待验收",
    });
  });
});
