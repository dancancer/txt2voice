import {
  fitPromptToBudget,
  preservePromptValueEdges,
} from "../runtime/prompt-budget";

describe("prompt budget", () => {
  it("保留普通文本变量的首尾内容", () => {
    const value = "开头-" + "甲".repeat(40) + "-结尾";

    expect(preservePromptValueEdges(value, 14)).toContain("开头-");
    expect(preservePromptValueEdges(value, 14)).toContain("-结尾");
  });

  it("不会把 JSON 变量直接截成半截字符串", () => {
    const result = fitPromptToBudget({
      systemPrompt: "",
      maxPromptChars: 400,
      variables: {
        failed_artifact_json: JSON.stringify(
          {
            kind: "segment-scripting-failure",
            rawResponse: "X".repeat(200),
            structuredResult: {
              lines: [
                {
                  id: "line-1",
                  sourceText: "宁采臣抬头。",
                  text: "宁采臣抬头。",
                  speaker: "旁白",
                  orderInSegment: 0,
                },
              ],
            },
          },
          null,
          2
        ),
      },
      trimOrder: ["failed_artifact_json"],
      renderPrompt: (variables) => variables.failed_artifact_json,
      variableStrategies: {
        failed_artifact_json: "json_summary",
      },
    });

    expect(result.trimmedKeys).toContain("failed_artifact_json");
    expect(result.variables.failed_artifact_json).toContain('"kind"');
    expect(result.variables.failed_artifact_json).toContain('"rawResponseExcerpt"');
    expect(result.variables.failed_artifact_json).not.toContain('"rawResponse"');
    expect(() => JSON.parse(result.variables.failed_artifact_json)).not.toThrow();
  });
});
