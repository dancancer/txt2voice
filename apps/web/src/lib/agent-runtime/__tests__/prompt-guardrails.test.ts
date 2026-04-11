import fs from "fs";
import os from "os";
import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import { runSegmentRepairStage } from "../runtime/stages/run-segment-repair-stage";
import { runSegmentScriptingStage } from "../runtime/stages/run-segment-scripting-stage";
import { loadSkillRuntimeBundle } from "../runtime/load-skill-runtime-bundle";

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
  it("loads prompts from promptBundle instead of fixed prompts directory", async () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-bundle-"));
    const fixtureAgentDir = path.join(
      fixtureRoot,
      "agents",
      "script-generation"
    );
    const fixtureSkillDir = path.join(
      fixtureRoot,
      "skills",
      "script-generation"
    );
    const bundleDir = path.join(fixtureSkillDir, "bundle");

    fs.mkdirSync(fixtureAgentDir, { recursive: true });
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(
      path.join(fixtureAgentDir, "agent.toml"),
      [
        'id = "script-generation-agent"',
        'version = "1"',
        'role = "generate_segment_script_draft"',
        'compatibleWorkflowStages = ["segment_scripting"]',
        'allowedSkills = ["script-generation"]',
        "allowedTools = []",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(fixtureAgentDir, "AGENT.md"), "# Fixture Agent\n", "utf8");
    fs.writeFileSync(
      path.join(fixtureSkillDir, "skill.toml"),
      [
        'id = "script-generation"',
        'version = "1"',
        'kind = "generation"',
        'compatibleAgents = ["script-generation-agent"]',
        'inputSchemaRef = "segment-script-input"',
        'outputSchemaRef = "segment-script-draft"',
        'contextRequirements = ["segment", "character_memory_summary"]',
        "toolAllowlist = []",
        'promptBundle = ["bundle/system.md", "bundle/user.md"]',
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(fixtureSkillDir, "SKILL.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(bundleDir, "system.md"), "bundle system", "utf8");
    fs.writeFileSync(
      path.join(bundleDir, "user.md"),
      "bundle user {{segment_text}}",
      "utf8"
    );

    const adapter = createMockAdapter();

    await runSegmentScriptingStage({
      workflowRunId: "wf-script-prompt-bundle",
      segmentId: "segment-script-prompt-bundle",
      segmentText: "宁采臣抬头。",
      skillDir: fixtureSkillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      systemPrompt: string;
      prompt: string;
    };

    expect(call.systemPrompt).toContain("bundle system");
    expect(call.prompt).toContain("bundle user 宁采臣抬头。");
  });

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

  it("script-generation prompt requires canonical speaker names when known aliases already exist", () => {
    const bundle = loadSkillRuntimeBundle(workspaceRoot, "script-generation");

    expect(bundle.systemPrompt).toContain("canonical 名称");
    expect(bundle.systemPrompt).toContain("不要输出别名变体");
  });

  it("quality prompt does not ask the judge to score fields that the draft does not contain", () => {
    const bundle = loadSkillRuntimeBundle(workspaceRoot, "quality-judgement");

    expect(bundle.systemPrompt).not.toContain("情绪、语气、朗读意图");
  });

  it("character extraction prompt treats alias source as a provenance label instead of a strict trace id", () => {
    const bundle = loadSkillRuntimeBundle(workspaceRoot, "character-extraction");

    expect(bundle.userPrompt).not.toContain("要带 `source`");
    expect(bundle.userPrompt).toContain("source");
    expect(bundle.userPrompt).toContain("llm");
  });
});
