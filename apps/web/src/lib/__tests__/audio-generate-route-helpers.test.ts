import { ValidationError } from "@/lib/error-handler";
import { assertAudioGenerationAllowed } from "@/app/api/books/[id]/audio/generate/route-helpers";

describe("audio generate route helpers", () => {
  it("allows audio generation when script sentences already exist even if book status is error", () => {
    expect(() =>
      assertAudioGenerationAllowed({
        status: "error",
        scriptSentenceCount: 177,
      })
    ).not.toThrow();
  });

  it("blocks audio generation when there are no scripts and status is not ready", () => {
    expect(() =>
      assertAudioGenerationAllowed({
        status: "processed",
        scriptSentenceCount: 0,
      })
    ).toThrow(ValidationError);
  });
});
