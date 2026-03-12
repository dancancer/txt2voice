// 一旦我被更新，请更新我的开头注释
// input: Script Validation 复核 issueDetail
// output: 详情展示模型断言
// pos: review 脚本失败详情测试
import { buildScriptValidationDetailView } from "../script-validation-detail";
import {
  getScriptValidationRecommendedActionLabel,
  listScriptValidationSubtypesByRecommendedAction,
} from "@/lib/script-validation-detail";

describe("script-validation-detail", () => {
  it("should normalize script validation detail for review cards", () => {
    const detail = buildScriptValidationDetailView({
      issueSubtype: "COVERAGE",
      issueDetail: {
        message: "段落台本校验失败：原文覆盖率过低",
        stage: "script_validation",
        errorCode: "SCRIPT_VALIDATION_FAILED",
        coverageRatio: 0.8123,
        issueCodes: ["LOW_COVERAGE", "NON_WHITESPACE_GAP", "LOW_COVERAGE"],
        issueMessages: ["原文覆盖率过低", "尾部存在未覆盖内容"],
        issuePreviews: ["第二段原文", "“你好。”"],
        segmentPreview: "第二段原文，有校验问题",
      },
    });

    expect(detail).toMatchObject({
      subtypeLabel: "覆盖率不足",
      summary: "原文覆盖率过低",
      stage: "script_validation",
      errorCode: "SCRIPT_VALIDATION_FAILED",
      coverageLabel: "81.2%",
      issueCodes: ["LOW_COVERAGE", "NON_WHITESPACE_GAP"],
      issueMessages: ["原文覆盖率过低", "尾部存在未覆盖内容"],
      issuePreviews: ["第二段原文", "“你好。”"],
      segmentPreview: "第二段原文，有校验问题",
      actionHints: [
        "优先重生台本，确认这一段是否需要更小粒度切段。",
        "若连续失败，回看完整问题列表与原文预览，确认是否存在稳定漏句。",
      ],
      recommendedAction: "regenerate",
      recommendedActionLabel: "重生",
      hasDetails: true,
    });
  });

  it("should fall back to generic guidance for unknown subtype", () => {
    const detail = buildScriptValidationDetailView({
      issueSubtype: "OTHER",
      issueDetail: {
        issueMessages: ["模型输出异常"],
      },
    });

    expect(detail.actionHints).toEqual([
      "先查看完整问题列表与原文预览，再决定通过或重生。",
    ]);
    expect(detail.recommendedAction).toBeNull();
    expect(detail.recommendedActionLabel).toBe("");
  });

  it("should degrade gracefully for empty detail payload", () => {
    const detail = buildScriptValidationDetailView({
      issueSubtype: "OTHER",
      issueDetail: {},
    });

    expect(detail).toMatchObject({
      subtypeLabel: "其他脚本问题",
      summary: "",
      coverageLabel: null,
      issueCodes: [],
      issueMessages: [],
      issuePreviews: [],
      segmentPreview: "",
      actionHints: [
        "先查看完整问题列表与原文预览，再决定通过或重生。",
      ],
      recommendedAction: null,
      recommendedActionLabel: "",
      hasDetails: false,
    });
  });

  it("should expose recommended action metadata for filtering", () => {
    expect(getScriptValidationRecommendedActionLabel("regenerate")).toBe("重生");
    expect(listScriptValidationSubtypesByRecommendedAction("regenerate")).toContain(
      "COVERAGE"
    );
    expect(listScriptValidationSubtypesByRecommendedAction("approve")).toEqual([]);
  });
});
