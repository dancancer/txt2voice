import {
  filterToolsByAllowlist,
  isToolAllowed,
  type RuntimeToolContract,
} from "../tools/contracts";
import {
  checkScriptCoverage,
  validateStructuredOutput,
} from "../tools/validation-tools";
import {
  COMMIT_SCRIPT_SENTENCES_TOOL,
  LOAD_CHARACTER_MEMORY_TOOL,
  LOAD_SEGMENT_BATCH_TOOL,
  SAVE_CHARACTER_MEMORY_TOOL,
  SAVE_SCRIPT_DRAFT_TOOL,
} from "../tools/io-tools";
import { SYNC_MANUAL_REVIEW_ITEMS_TOOL } from "../tools/review-tools";
import {
  CREATE_MANUAL_REVIEW_ITEM_TOOL,
  ESTIMATE_TOKEN_BUDGET_TOOL,
} from "../tools/task-tools";

describe("tool contracts", () => {
  it("restricts tool access with allowlist", () => {
    const contracts: RuntimeToolContract[] = [
      { name: "validate-structured-output", kind: "validation", sideEffect: false },
      { name: "check-script-coverage", kind: "validation", sideEffect: false },
      { name: "save-character-memory", kind: "io", sideEffect: true },
    ];
    const allowlist = ["validate-structured-output", "check-script-coverage"];

    expect(isToolAllowed(allowlist, "validate-structured-output")).toBe(true);
    expect(isToolAllowed(allowlist, "save-character-memory")).toBe(false);
    expect(filterToolsByAllowlist(contracts, allowlist).map((item) => item.name)).toEqual([
      "validate-structured-output",
      "check-script-coverage",
    ]);
  });

  it("returns stable results for structured output and script coverage checks", () => {
    const structured = validateStructuredOutput({
      value: { id: "line-1", text: "hello" },
      requiredKeys: ["id", "text", "speaker"],
    });

    expect(structured).toEqual({
      valid: false,
      missingKeys: ["speaker"],
    });

    const coverage = checkScriptCoverage({
      sourceText: "abcde",
      scriptFragments: ["ab", "de"],
    });

    expect(coverage).toEqual({
      valid: false,
      coverageRatio: 0.8,
      uncoveredChars: 1,
    });

    const repeatedCoverage = checkScriptCoverage({
      sourceText: "abab",
      scriptFragments: ["ab", "ab"],
    });

    expect(repeatedCoverage).toEqual({
      valid: true,
      coverageRatio: 1,
      uncoveredChars: 0,
    });

    const overlappingCoverage = checkScriptCoverage({
      sourceText: "aaaa",
      scriptFragments: ["aa", "aa"],
    });

    expect(overlappingCoverage).toEqual({
      valid: true,
      coverageRatio: 1,
      uncoveredChars: 0,
    });
  });

  it("marks commit and memory-save tools as side-effect tools", () => {
    expect(COMMIT_SCRIPT_SENTENCES_TOOL.sideEffect).toBe(true);
    expect(SAVE_CHARACTER_MEMORY_TOOL.sideEffect).toBe(true);
    expect(SAVE_CHARACTER_MEMORY_TOOL.kind).toBe("io");
    expect(SYNC_MANUAL_REVIEW_ITEMS_TOOL.sideEffect).toBe(true);
    expect(SYNC_MANUAL_REVIEW_ITEMS_TOOL.kind).toBe("task");
  });

  it("defines the missing runtime tool contracts needed by phase 2", () => {
    expect(LOAD_SEGMENT_BATCH_TOOL).toEqual(
      expect.objectContaining({
        name: "load-segment-batch",
        kind: "io",
        sideEffect: false,
      })
    );
    expect(LOAD_CHARACTER_MEMORY_TOOL).toEqual(
      expect.objectContaining({
        name: "load-character-memory",
        kind: "io",
        sideEffect: false,
      })
    );
    expect(SAVE_SCRIPT_DRAFT_TOOL).toEqual(
      expect.objectContaining({
        name: "save-script-draft",
        kind: "io",
        sideEffect: true,
      })
    );
    expect(CREATE_MANUAL_REVIEW_ITEM_TOOL).toEqual(
      expect.objectContaining({
        name: "create-manual-review-item",
        kind: "task",
        sideEffect: true,
      })
    );
    expect(ESTIMATE_TOKEN_BUDGET_TOOL).toEqual(
      expect.objectContaining({
        name: "estimate-token-budget",
        kind: "task",
        sideEffect: false,
      })
    );
  });
});
