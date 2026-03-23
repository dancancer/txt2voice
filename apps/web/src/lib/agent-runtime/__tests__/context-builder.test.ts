import { buildAgentContext } from "../context";
import type { CharacterMemory, ValidationReport } from "../context";

const createMemory = (): CharacterMemory => ({
  canonicalIdentities: [
    { id: "char-1", name: "Alice" },
    { id: "char-2", name: "Bob" },
    { id: "char-3", name: "Carol" },
  ],
  aliasEvidence: [
    { alias: "A", canonicalId: "char-1", source: "segment-1" },
    { alias: "B", canonicalId: "char-2", source: "segment-2" },
  ],
  assertedFacts: {
    "char-1": { role: "main" },
    "char-2": { role: "secondary" },
  },
  inferredHints: {
    "char-3": { style: "quiet" },
  },
});

describe("context builder", () => {
  it("builds script-generation context with single-segment input and budget", () => {
    const context = buildAgentContext({
      agentId: "script-generation-agent",
      segmentText: "Only this segment is visible to the script agent.",
      fullBookText:
        "This is the whole book text and should never be injected into script input context.",
      characterMemory: createMemory(),
      policyContext: {
        strictCoverage: true,
      },
      budget: {
        maxContextChars: 300,
        reservedOutputChars: 80,
      },
    });

    expect(context.inputContext.segmentText).toBe(
      "Only this segment is visible to the script agent."
    );
    expect("fullBookText" in context.inputContext).toBe(false);
    expect(context.referenceMemory.characterMemorySummary.length).toBeGreaterThan(0);
    expect(context.policyContext).toMatchObject({ strictCoverage: true });
    expect(context.executionContext.maxContextChars).toBe(300);
    expect(context.executionContext.reservedOutputChars).toBe(80);
  });

  it("builds repair context with failed artifact and without full-book input", () => {
    const failedArtifact: ValidationReport = {
      segmentId: "segment-9",
      valid: false,
      coverageRatio: 0.55,
      issues: [{ code: "LOW_COVERAGE", message: "coverage is too low" }],
    };

    const context = buildAgentContext({
      agentId: "repair-agent",
      segmentText: "Original segment",
      fullBookText: "Whole book text must be excluded.",
      failedArtifact,
      characterMemory: createMemory(),
      budget: {
        maxContextChars: 260,
        reservedOutputChars: 60,
      },
    });

    expect(context.inputContext.failedArtifact).toMatchObject({
      segmentId: "segment-9",
      valid: false,
    });
    expect("fullBookText" in context.inputContext).toBe(false);
  });

  it("trims reference memory before touching segment input when budget is tight", () => {
    const longSegment = "segment::" + "x".repeat(120);

    const context = buildAgentContext({
      agentId: "script-generation-agent",
      segmentText: longSegment,
      fullBookText: "book::" + "y".repeat(500),
      characterMemory: createMemory(),
      budget: {
        maxContextChars: 90,
        reservedOutputChars: 30,
      },
    });

    expect(context.inputContext.segmentText).toBe(longSegment);
    expect(context.referenceMemory.characterMemorySummary.length).toBeLessThanOrEqual(
      context.executionContext.remainingReferenceChars
    );
    expect(context.executionContext.remainingReferenceChars).toBeGreaterThanOrEqual(0);
  });
});
