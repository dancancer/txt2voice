import {
  buildAgentContext,
  buildCharacterMemoryFromProfiles,
} from "../context";
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

  it("surfaces explicit over-budget state when input alone exceeds budget", () => {
    const overBudgetSegment = "segment::" + "z".repeat(300);

    const context = buildAgentContext({
      agentId: "script-generation-agent",
      segmentText: overBudgetSegment,
      fullBookText: "book::" + "k".repeat(600),
      characterMemory: createMemory(),
      budget: {
        maxContextChars: 100,
        reservedOutputChars: 40,
      },
    });

    expect(context.inputContext.segmentText).toBe(overBudgetSegment);
    expect(context.executionContext.remainingReferenceChars).toBe(0);
    expect(context.executionContext.inputOverBudget).toBe(true);
  });

  it("builds character memory from workflow character profiles before prompt injection", () => {
    const memory = buildCharacterMemoryFromProfiles([
      {
        id: "char-1",
        canonicalName: "宁采臣",
        aliases: [{ alias: "宁公子" }],
        characteristics: {
          description: "书生",
          personality: ["善良", "文弱"],
          importance: "main",
        },
        voicePreferences: {
          dialogueStyle: "文雅",
        },
        genderHint: "male",
        ageHint: 20,
      } as any,
      {
        id: "char-2",
        canonicalName: "燕赤霞",
        aliases: [{ alias: "燕大侠" }],
        characteristics: {
          personality: ["冷峻"],
          importance: "secondary",
        },
        voicePreferences: {
          dialogueStyle: "豪迈",
        },
        genderHint: "male",
      } as any,
    ]);

    expect(memory.canonicalIdentities).toEqual([
      { id: "char-1", name: "宁采臣" },
      { id: "char-2", name: "燕赤霞" },
    ]);
    expect(memory.aliasEvidence).toEqual([
      { alias: "宁公子", canonicalId: "char-1", source: "profile:char-1" },
      { alias: "燕大侠", canonicalId: "char-2", source: "profile:char-2" },
    ]);
    expect(memory.assertedFacts).toEqual({
      "char-1": {
        description: "书生",
        personality: ["善良", "文弱"],
        importance: "main",
        dialogueStyle: "文雅",
        gender: "male",
        age: 20,
      },
      "char-2": {
        personality: ["冷峻"],
        importance: "secondary",
        dialogueStyle: "豪迈",
        gender: "male",
      },
    });
  });

  it("keeps fact-level character memory in the prompt reference summary", () => {
    const memory = buildCharacterMemoryFromProfiles([
      {
        id: "char-1",
        canonicalName: "宁采臣",
        aliases: [{ alias: "宁公子" }],
        characteristics: {
          description: "书生",
          personality: ["善良"],
          importance: "main",
        },
        voicePreferences: {
          dialogueStyle: "文雅",
        },
        genderHint: "male",
        ageHint: 20,
      } as any,
    ]);

    const context = buildAgentContext({
      agentId: "script-generation-agent",
      segmentText: "宁采臣抬头。",
      characterMemory: memory,
      budget: {
        maxContextChars: 1200,
        reservedOutputChars: 200,
      },
    });

    expect(context.referenceMemory.characterMemorySummary).toContain('"name":"宁采臣"');
    expect(context.referenceMemory.characterMemorySummary).toContain('"aliases":["宁公子"]');
    expect(context.referenceMemory.characterMemorySummary).toContain(
      '"dialogueStyle":"文雅"'
    );
    expect(context.referenceMemory.characterMemorySummary).toContain(
      '"personality":["善良"]'
    );
  });

  it("keeps trimmed character memory summary as parseable JSON", () => {
    const memory: CharacterMemory = {
      canonicalIdentities: Array.from({ length: 12 }, (_, index) => ({
        id: `char-${index + 1}`,
        name: `角色${index + 1}`,
      })),
      aliasEvidence: Array.from({ length: 24 }, (_, index) => ({
        alias: `别名${index + 1}-${"甲".repeat(18)}`,
        canonicalId: `char-${(index % 12) + 1}`,
        source: `segment-${index + 1}`,
      })),
      assertedFacts: Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => [
          `char-${index + 1}`,
          {
            description: `描述${index + 1}-${"乙".repeat(80)}`,
            personality: [`性格${index + 1}-${"丙".repeat(20)}`],
          },
        ])
      ),
      inferredHints: {},
    };

    const context = buildAgentContext({
      agentId: "script-generation-agent",
      segmentText: "宁采臣抬头。",
      characterMemory: memory,
      budget: {
        maxContextChars: 420,
        reservedOutputChars: 180,
      },
    });

    expect(() =>
      JSON.parse(context.referenceMemory.characterMemorySummary)
    ).not.toThrow();
    expect(context.referenceMemory.characterMemorySummary.length).toBeLessThanOrEqual(
      context.executionContext.remainingReferenceChars
    );
  });

  it("prioritizes characters mentioned in the current segment when trimming memory", () => {
    const context = buildAgentContext({
      agentId: "script-generation-agent",
      segmentText: "压轴出场的是燕赤霞，他让宁采臣后退。",
      characterMemory: {
        canonicalIdentities: [
          { id: "char-1", name: "前置角色一" },
          { id: "char-2", name: "前置角色二" },
          { id: "char-3", name: "燕赤霞" },
        ],
        aliasEvidence: [
          { alias: "燕大侠", canonicalId: "char-3", source: "profile:char-3" },
        ],
        assertedFacts: {
          "char-1": { description: `描述一${"甲".repeat(140)}` },
          "char-2": { description: `描述二${"乙".repeat(140)}` },
          "char-3": { description: "关键角色" },
        },
        inferredHints: {},
      },
      budget: {
        maxContextChars: 340,
        reservedOutputChars: 160,
      },
    });

    expect(context.referenceMemory.characterMemorySummary).toContain("燕赤霞");
  });
});
