import { loadAgentDefinition } from "../../registry";
import type { AgentDefinition } from "../../protocol";
import { compileSkill, type CompiledMastraSkill } from "./compile-skill";
import { ensureMastraWebGlobals } from "../shared/ensure-mastra-web-globals";

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
      model: "openai:gpt-4.1-mini",
    }),
  };
};
