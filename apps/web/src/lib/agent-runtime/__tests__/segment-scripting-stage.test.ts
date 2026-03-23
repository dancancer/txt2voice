import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import { runSegmentScriptingStage } from "../runtime/stages/run-segment-scripting-stage";

const createMockAdapter = (content: string): LLMAdapter => ({
  call: jest.fn().mockResolvedValue({
    content,
    provider: "mock-provider",
    model: "mock-model",
    latencyMs: 5,
    usage: null,
  }),
});

const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const skillDir = path.join(workspaceRoot, "skills/script-generation");

describe("segment scripting stage", () => {
  it("produces SegmentScriptDraft for single segment input", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-1",
      segmentId: "segment-1",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.artifact.kind).toBe("segment-script-draft");
    expect(result.artifact.segmentScriptDraft.segmentId).toBe("segment-1");
    expect(result.artifact.segmentScriptDraft.lines).toHaveLength(1);
  });

  it("keeps required line fields in draft", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "“快走！”燕赤霞低喝。",
            text: "快走！",
            speaker: "燕赤霞",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-2",
      segmentId: "segment-2",
      segmentText: "“快走！”燕赤霞低喝。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.artifact.segmentScriptDraft.lines[0]).toEqual({
      id: "line-1",
      sourceText: "“快走！”燕赤霞低喝。",
      text: "快走！",
      speaker: "燕赤霞",
      orderInSegment: 0,
    });
  });

  it("returns draft artifact only and does not expose persistence outputs", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "路人甲点头。",
            text: "路人甲点头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-3",
      segmentId: "segment-3",
      segmentText: "路人甲点头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.artifact).toEqual({
      kind: "segment-script-draft",
      skillId: "script-generation",
      segmentScriptDraft: expect.objectContaining({
        segmentId: "segment-3",
      }),
    });
    expect((result as Record<string, unknown>).scriptSentences).toBeUndefined();
    expect((result as Record<string, unknown>).persisted).toBeUndefined();
  });
});
