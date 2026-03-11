// 一旦我被更新，请更新我的开头注释
// input: 脚本校验 issueDetail
// output: 子类型映射断言
// pos: Script Validation 子类型测试
import {
  getScriptValidationSubtypeLabel,
  resolveScriptValidationSubtype,
} from "@/lib/script-validation-review";

describe("script-validation-review", () => {
  it("should map coverage issue codes to COVERAGE subtype", () => {
    expect(
      resolveScriptValidationSubtype({
        issueCodes: ["LOW_COVERAGE"],
      })
    ).toBe("COVERAGE");
  });

  it("should map quoted narration to dialogue narration conflict", () => {
    expect(
      resolveScriptValidationSubtype({
        issueCodes: ["QUOTED_NARRATION"],
      })
    ).toBe("DIALOGUE_NARRATION_CONFLICT");
  });

  it("should map errorCode before generic issue codes", () => {
    expect(
      resolveScriptValidationSubtype({
        errorCode: "DIALOGUE_TOO_LONG",
        issueCodes: ["LOW_COVERAGE"],
      })
    ).toBe("DIALOGUE_TOO_LONG");
  });

  it("should provide readable subtype labels", () => {
    expect(getScriptValidationSubtypeLabel("BOUNDARY_DRIFT")).toBe(
      "改写/边界漂移"
    );
  });
});
