import fs from "fs";
import path from "path";

import { compileAgent } from "@/lib/agent-runtime/mastra/compiler/compile-agent";
import { compileWorkflow } from "@/lib/agent-runtime/mastra/compiler/compile-workflow";
import { createMastraRuntime } from "@/lib/agent-runtime/mastra/runtime";

const resolveWorkspaceRoot = (): string => {
  let current = process.cwd();

  for (let index = 0; index < 10; index += 1) {
    const hasAgents = fs.existsSync(path.join(current, "agents"));
    const hasSkills = fs.existsSync(path.join(current, "skills"));
    const hasWorkflows = fs.existsSync(path.join(current, "workflows"));

    if (hasAgents && hasSkills && hasWorkflows) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error("Unable to resolve workspace root for Mastra entry");
};

const rootDir = resolveWorkspaceRoot();

const characterDiscoveryAgent = compileAgent(rootDir, "character-discovery");
const scriptGenerationAgent = compileAgent(rootDir, "script-generation");
const repairAgent = compileAgent(rootDir, "repair");
const qualityJudgeAgent = compileAgent(rootDir, "quality-judge");
const coordinatorAgent = compileAgent(rootDir, "coordinator");
const scriptProductionWorkflow = compileWorkflow(rootDir, "script-production");

const runtime = createMastraRuntime({
  agents: {
    [characterDiscoveryAgent.definition.id]: characterDiscoveryAgent.agent,
    [scriptGenerationAgent.definition.id]: scriptGenerationAgent.agent,
    [repairAgent.definition.id]: repairAgent.agent,
    [qualityJudgeAgent.definition.id]: qualityJudgeAgent.agent,
    [coordinatorAgent.definition.id]: coordinatorAgent.agent,
  },
  workflows: {
    [scriptProductionWorkflow.definition.id]: scriptProductionWorkflow.workflow,
  },
  server: {
    auth: null,
    rbac: null,
  },
});

export const mastra = runtime.mastra;
export const modelProvider = runtime.modelProvider;
export const runtimeProvider = runtime.provider;

export const compiledAgents = {
  characterDiscoveryAgent,
  scriptGenerationAgent,
  repairAgent,
  qualityJudgeAgent,
  coordinatorAgent,
};

export const compiledWorkflows = {
  scriptProductionWorkflow,
};

export default mastra;
