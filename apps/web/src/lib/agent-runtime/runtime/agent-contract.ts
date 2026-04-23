import type { SkillDefinition } from "../protocol";
import { loadAgentDefinition } from "../registry";
import {
  resolveAllowedToolNames,
  type RuntimeToolContract,
} from "../tools/contracts";

export interface AgentContractValidationResult {
  allowedToolNames: string[];
  agentInstructions: string;
}

export const validateAgentContract = (params: {
  workspaceRoot: string;
  agentSourceId: string;
  stageId: string;
  skill: SkillDefinition;
  registeredTools?: RuntimeToolContract[];
}): AgentContractValidationResult => {
  const loadedAgent = loadAgentDefinition(
    params.workspaceRoot,
    params.agentSourceId
  );
  const agent = loadedAgent.definition;

  if (!agent.compatibleWorkflowStages.includes(params.stageId)) {
    throw new Error(
      `Agent ${agent.id} is not compatible with workflow stage ${params.stageId}`
    );
  }

  if (!agent.allowedSkills.includes(params.skill.id)) {
    throw new Error(`Agent ${agent.id} does not allow skill ${params.skill.id}`);
  }

  const allowedToolNames = resolveAllowedToolNames({
    agentAllowedTools: agent.allowedTools,
    skillToolAllowlist: params.skill.toolAllowlist,
    registeredTools: params.registeredTools ?? [],
  });

  if (
    (agent.allowedTools.length > 0 || params.skill.toolAllowlist.length > 0) &&
    allowedToolNames.length === 0
  ) {
    throw new Error(
      `Agent ${agent.id} and skill ${params.skill.id} do not expose any allowed runtime tools`
    );
  }

  return {
    allowedToolNames,
    agentInstructions: loadedAgent.instructions,
  };
};
