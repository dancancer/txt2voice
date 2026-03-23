import fs from "fs";
import path from "path";

const schemaPath = path.resolve(
  process.cwd(),
  "prisma/schema.prisma"
);

const readSchema = () => fs.readFileSync(schemaPath, "utf8");

const expectModel = (schema: string, modelName: string) => {
  expect(schema).toMatch(new RegExp(`model\\s+${modelName}\\s+\\{`));
};

const expectField = (schema: string, modelName: string, fieldName: string) => {
  const modelBlock = schema.match(
    new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`, "m")
  );

  expect(modelBlock?.[1]).toBeDefined();
  expect(modelBlock?.[1]).toMatch(new RegExp(`\\b${fieldName}\\b`));
};

describe("agent runtime prisma schema shape", () => {
  it("defines workflow execution models with minimum keys", () => {
    const schema = readSchema();

    expectModel(schema, "WorkflowRun");
    expectField(schema, "WorkflowRun", "workflowId");
    expectField(schema, "WorkflowRun", "bookId");
    expectField(schema, "WorkflowRun", "processingTaskId");
    expectField(schema, "WorkflowRun", "status");

    expectModel(schema, "StageRun");
    expectField(schema, "StageRun", "workflowRunId");
    expectField(schema, "StageRun", "stageId");
    expectField(schema, "StageRun", "status");

    expectModel(schema, "AgentRun");
    expectField(schema, "AgentRun", "stageRunId");
    expectField(schema, "AgentRun", "agentId");
    expectField(schema, "AgentRun", "skillId");
    expectField(schema, "AgentRun", "status");

    expectModel(schema, "ToolCall");
    expectField(schema, "ToolCall", "agentRunId");
    expectField(schema, "ToolCall", "toolName");
    expectField(schema, "ToolCall", "status");

    expectModel(schema, "TraceEvent");
    expectField(schema, "TraceEvent", "workflowRunId");
    expectField(schema, "TraceEvent", "stageRunId");
    expectField(schema, "TraceEvent", "agentRunId");
    expectField(schema, "TraceEvent", "eventType");
  });
});
