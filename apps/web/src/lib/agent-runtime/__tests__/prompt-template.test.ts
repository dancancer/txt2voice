import { renderPromptTemplate } from "../runtime/prompt-template";

describe("prompt template", () => {
  it("fails fast when the template references a missing variable", () => {
    expect(() =>
      renderPromptTemplate("文本：{{segment_text}}\n角色：{{character_memory_summary}}", {
        segment_text: "宁采臣抬头。",
      })
    ).toThrow("Missing prompt template variables");
  });
});
