import { loadAgentDefinition } from "../../registry";
import { getConfiguredLLMProvider } from "@/lib/llm-service";
import type { AgentDefinition } from "../../protocol";
import { compileSkill, type CompiledMastraSkill } from "./compile-skill";
import { ensureMastraWebGlobals } from "../shared/ensure-mastra-web-globals";
import { resolveLLMExecutionPolicy } from "../../runtime/model-policy";

type MastraAgentInstance = InstanceType<typeof import("@mastra/core/agent").Agent>;

export interface CompiledMastraAgent {
  definition: AgentDefinition;
  instructions: string;
  skill: CompiledMastraSkill;
  agent: MastraAgentInstance;
}

export const compileAgent = (
  rootDir: string,
  agentId: string
): CompiledMastraAgent => {
  const loadedAgent = loadAgentDefinition(rootDir, agentId);
  const primarySkillId = loadedAgent.definition.allowedSkills[0];
  const skill = compileSkill(rootDir, primarySkillId);
  const policy = resolveLLMExecutionPolicy(skill.definition.modelPolicy);
  const provider = getConfiguredLLMProvider(policy.modelId);
  ensureMastraWebGlobals();
  const { Agent } = require("@mastra/core/agent") as typeof import("@mastra/core/agent");

  return {
    definition: loadedAgent.definition,
    instructions: loadedAgent.instructions,
    skill,
    agent: new Agent({
      id: loadedAgent.definition.id,
      name: loadedAgent.definition.id,
      instructions: [loadedAgent.instructions, skill.mastraInstructions]
        .filter((entry) => entry.trim().length > 0)
        .join("\n\n"),
      model: `${provider.name}:${provider.model}`,
    }),
  };
};
