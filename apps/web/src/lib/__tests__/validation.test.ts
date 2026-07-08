import { AudioGenerationOptionsSchema } from "@/lib/validation";

describe("validation schemas", () => {
  it("accepts preferredProvider for audio generation options", () => {
    expect(
      AudioGenerationOptionsSchema.parse({
        preferredProvider: "voxcpm",
        batchSize: 1,
      })
    ).toMatchObject({
      preferredProvider: "voxcpm",
      batchSize: 1,
    });
  });

  it("rejects the stale provider filter field", () => {
    expect(() =>
      AudioGenerationOptionsSchema.strict().parse({
        provider: "voxcpm",
      })
    ).toThrow();
  });
});
