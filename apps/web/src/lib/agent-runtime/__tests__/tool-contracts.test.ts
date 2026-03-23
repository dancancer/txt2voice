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
  SAVE_CHARACTER_MEMORY_TOOL,
} from "../tools/io-tools";

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
  });

  it("marks commit and memory-save tools as side-effect tools", () => {
    expect(COMMIT_SCRIPT_SENTENCES_TOOL.sideEffect).toBe(true);
    expect(SAVE_CHARACTER_MEMORY_TOOL.sideEffect).toBe(true);
    expect(SAVE_CHARACTER_MEMORY_TOOL.kind).toBe("io");
  });
});
