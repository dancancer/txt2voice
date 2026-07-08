import { buildSkillMetadataSnapshot } from "../runtime/script-production-runtime-helpers";

describe("skill metadata snapshot", () => {
  it("fingerprints prompt contents instead of raw bundle paths", () => {
    const buildSnapshot = buildSkillMetadataSnapshot as any;
    const definition = {
      promptBundle: ["prompts/system.md", "prompts/user.md"],
      modelPolicy: "balanced",
      repairPolicy: "handoff-to-json-repair",
      successCriteria: ["returns-segment-script-draft"],
      telemetryTags: ["runtime", "segment-scripting"],
    };

    const left = buildSnapshot(definition, {
      systemPrompt: "system-a",
      userPrompt: "user-a",
      runtimeSystemPrompt: "agent-a\nskill-a\nsystem-a",
    });
    const right = buildSnapshot(definition, {
      systemPrompt: "system-a",
      userPrompt: "user-b",
      runtimeSystemPrompt: "agent-a\nskill-a\nsystem-a",
    });

    expect(left.promptFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(left.promptFingerprint).not.toBe("prompts/system.md|prompts/user.md");
    expect(left.promptFingerprint).not.toBe(right.promptFingerprint);
  });
});
