import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import { runSegmentRepairStage } from "../runtime/stages/run-segment-repair-stage";
import { runSegmentScriptingStage } from "../runtime/stages/run-segment-scripting-stage";

const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const scriptSkillDir = path.join(workspaceRoot, "skills/script-generation");
const repairSkillDir = path.join(workspaceRoot, "skills/json-repair");

const createMockAdapter = (): LLMAdapter => ({
  call: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      lines: [
        {
          id: "line-1",
          sourceText: "宁采臣抬头。",
          text: "宁采臣抬头。",
          speaker: "旁白",
          orderInSegment: 0,
        },
      ],
    }),
    provider: "mock-provider",
    model: "mock-model",
    latencyMs: 5,
    usage: null,
  }),
});

describe("production prompt guardrails", () => {
  it("script-generation prompt carries anti-rewrite and source-alignment rules", async () => {
    const adapter = createMockAdapter();

    await runSegmentScriptingStage({
      workflowRunId: "wf-script-prompt-guardrails",
      segmentId: "segment-script-prompt-guardrails",
      segmentText:
        "龙雅歌转回宝座，悠声吩咐道。“把衣服换上，本宫有话要问。”",
      skillDir: scriptSkillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      systemPrompt: string;
      prompt: string;
    };

    expect(call.systemPrompt).toContain("必须完整覆盖原文");
    expect(call.systemPrompt).toContain("不能总结、压缩、改写、解释或补写原文");
    expect(call.systemPrompt).toContain("旁白的 text 必须与 sourceText 完全一致");
    expect(call.systemPrompt).toContain("不要把叙事改写成括号里的舞台说明");
    expect(call.prompt).toContain("不要漏字，不要重抽");
  });

  it("json-repair prompt forbids empty text and explains narration fallback", async () => {
    const adapter = createMockAdapter();

    await runSegmentRepairStage({
      workflowRunId: "wf-repair-prompt-guardrails",
      segmentId: "segment-repair-prompt-guardrails",
      segmentText:
        "龙雅歌转回宝座，悠声吩咐道。宁尘问：“出了何事？”",
      failureKind: "format_repair",
      failedArtifact: {
        kind: "segment-scripting-failure",
        rawResponse:
          '{"lines":[{"id":"line-0","sourceText":"龙雅歌转回宝座，悠声吩咐道。","text":"","speaker":"龙雅歌","orderInSegment":0}]}',
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir: repairSkillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      systemPrompt: string;
      prompt: string;
    };

    expect(call.systemPrompt).toContain("不要输出空字符串 text");
    expect(call.systemPrompt).toContain("如果 sourceText 是叙事句");
    expect(call.systemPrompt).toContain("text 必须与 sourceText 完全一致");
    expect(call.systemPrompt).toContain("像“宁尘说。”这类没有真正对白的句子");
    expect(call.prompt).toContain('\\"text\\":\\"\\"');
  });
});
