import {
  type AgentDefinition,
  type ArtifactEnvelope,
  type ExecutionEvent,
  type SkillDefinition,
  type ToolContract,
  type WorkflowDefinition,
  isAgentDefinition,
  isExecutionEvent,
  isSkillDefinition,
  isToolContract,
  isWorkflowDefinition,
} from "../protocol";

describe("agent runtime protocol definitions", () => {
  it("accepts valid protocol definitions", () => {
    const agent: AgentDefinition = {
      id: "script-generation-agent",
      version: "1",
      role: "generate_segment_script",
      compatibleWorkflowStages: ["segment_scripting"],
      allowedSkills: ["script-generation"],
      allowedTools: ["validate-structured-output"],
    };
    const skill: SkillDefinition = {
      id: "script-generation",
      version: "1",
      kind: "generation",
      compatibleAgents: ["script-generation-agent"],
      inputSchemaRef: "segment-script-input",
      outputSchemaRef: "segment-script-output",
      contextRequirements: ["segment", "character_memory"],
      toolAllowlist: ["validate-structured-output"],
    };
    const workflow: WorkflowDefinition = {
      id: "script-production",
      version: "1",
      kind: "workflow",
      stages: ["prepare", "segment_scripting", "persist"],
    };
    const tool: ToolContract = {
      name: "validate-structured-output",
      kind: "validation",
      sideEffect: false,
    };

    expect(isAgentDefinition(agent)).toBe(true);
    expect(isSkillDefinition(skill)).toBe(true);
    expect(isWorkflowDefinition(workflow)).toBe(true);
    expect(isToolContract(tool)).toBe(true);
  });

  it("rejects definitions with missing required fields", () => {
    expect(isAgentDefinition({ role: "missing-id" })).toBe(false);
    expect(
      isSkillDefinition({
        id: "skill-only",
        version: "1",
      })
    ).toBe(false);
    expect(
      isWorkflowDefinition({
        id: "workflow-only",
        version: "1",
      })
    ).toBe(false);
    expect(isToolContract({ name: "missing-kind" })).toBe(false);
  });

  it("exposes minimal artifact and event shapes", () => {
    const artifact: ArtifactEnvelope<{ foo: string }> = {
      id: "artifact-1",
      kind: "segment_script_draft",
      version: "1",
      createdAt: "2026-03-23T00:00:00.000Z",
      payload: { foo: "bar" },
    };
    const event: ExecutionEvent = {
      id: "event-1",
      kind: "agent_started",
      createdAt: "2026-03-23T00:00:00.000Z",
      workflowRunId: "workflow-run-1",
      status: "started",
    };

    expect(artifact.payload.foo).toBe("bar");
    expect(isExecutionEvent(event)).toBe(true);
    expect(
      isExecutionEvent({
        id: "event-2",
        createdAt: "2026-03-23T00:00:00.000Z",
        status: "started",
      })
    ).toBe(false);
  });

  it("rejects invalid optional execution event fields", () => {
    expect(
      isExecutionEvent({
        id: "event-3",
        kind: "agent_started",
        createdAt: "2026-03-23T00:00:00.000Z",
        workflowRunId: "workflow-run-1",
        status: "started",
        stageRunId: 42,
      })
    ).toBe(false);
    expect(
      isExecutionEvent({
        id: "event-4",
        kind: "agent_started",
        createdAt: "2026-03-23T00:00:00.000Z",
        workflowRunId: "workflow-run-1",
        status: "started",
        payload: 1,
      })
    ).toBe(false);
  });
});
