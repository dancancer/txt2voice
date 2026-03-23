import fs from "fs";
import path from "path";

import type {
  AgentDefinition,
  SkillDefinition,
  WorkflowDefinition,
} from "../protocol";
import {
  DefinitionRegistryError,
  assertDefinitionMarkdown,
  validateAgentDefinition,
  validateSkillDefinition,
  validateWorkflowDefinition,
} from "./validate-definition";

interface LoadedDefinition<TDefinition> {
  definition: TDefinition;
  instructions: string;
}

const parseStringArray = (rawValue: string) => {
  const content = rawValue.slice(1, -1).trim();

  if (!content) {
    return [];
  }

  return content
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => entry.replace(/^"|"$/g, ""))
    .filter((entry) => entry.length > 0);
};

const parseTomlValue = (params: {
  rawValue: string;
  definitionType: "agent" | "skill" | "workflow";
  definitionId: string;
}): string | string[] => {
  const { rawValue, definitionType, definitionId } = params;
  const value = rawValue.trim();

  if (value.startsWith("[") && value.endsWith("]")) {
    return parseStringArray(value);
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  throw new DefinitionRegistryError(
    "VALIDATION_ERROR",
    `Unsupported TOML value: ${rawValue}`,
    {
      definitionType,
      definitionId,
    }
  );
};

const parseSimpleToml = (params: {
  content: string;
  definitionType: "agent" | "skill" | "workflow";
  definitionId: string;
}) => {
  const { content, definitionType, definitionId } = params;
  const result: Record<string, unknown> = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = parseTomlValue({
      rawValue: value,
      definitionType,
      definitionId,
    });
  }

  return result;
};

const readTextFile = (filePath: string) => fs.readFileSync(filePath, "utf8");

const assertDefinitionFile = (params: {
  exists: boolean;
  definitionType: "agent" | "skill" | "workflow";
  definitionId: string;
  filename: string;
}) => {
  const { exists, definitionType, definitionId, filename } = params;

  if (exists) {
    return;
  }

  throw new DefinitionRegistryError(
    "AUTHORING_ERROR",
    `Missing ${filename} for ${definitionType} definition ${definitionId}`,
    {
      definitionType,
      definitionId,
      missingFile: filename,
    }
  );
};

const loadDefinitionFiles = (params: {
  rootDir: string;
  groupDir: "agents" | "skills" | "workflows";
  definitionId: string;
  tomlFilename: string;
  markdownFilename: string;
  definitionType: "agent" | "skill" | "workflow";
}) => {
  const {
    rootDir,
    groupDir,
    definitionId,
    tomlFilename,
    markdownFilename,
    definitionType,
  } = params;
  const baseDir = path.join(rootDir, groupDir, definitionId);
  const tomlPath = path.join(baseDir, tomlFilename);
  const markdownPath = path.join(baseDir, markdownFilename);

  assertDefinitionFile({
    exists: fs.existsSync(tomlPath),
    definitionType,
    definitionId,
    filename: tomlFilename,
  });

  assertDefinitionMarkdown({
    exists: fs.existsSync(markdownPath),
    definitionType,
    definitionId,
    filename: markdownFilename,
  });

  return {
    definitionId,
    toml: parseSimpleToml({
      content: readTextFile(tomlPath),
      definitionType,
      definitionId,
    }),
    markdown: readTextFile(markdownPath),
  };
};

export const loadAgentDefinition = (
  rootDir: string,
  definitionId: string
): LoadedDefinition<AgentDefinition> => {
  const files = loadDefinitionFiles({
    rootDir,
    groupDir: "agents",
    definitionId,
    tomlFilename: "agent.toml",
    markdownFilename: "AGENT.md",
    definitionType: "agent",
  });

  return {
    definition: validateAgentDefinition(files.toml, files.definitionId),
    instructions: files.markdown,
  };
};

export const loadSkillDefinition = (
  rootDir: string,
  definitionId: string
): LoadedDefinition<SkillDefinition> => {
  const files = loadDefinitionFiles({
    rootDir,
    groupDir: "skills",
    definitionId,
    tomlFilename: "skill.toml",
    markdownFilename: "SKILL.md",
    definitionType: "skill",
  });

  return {
    definition: validateSkillDefinition(files.toml, files.definitionId),
    instructions: files.markdown,
  };
};

export const loadWorkflowDefinition = (
  rootDir: string,
  definitionId: string
): LoadedDefinition<WorkflowDefinition> => {
  const files = loadDefinitionFiles({
    rootDir,
    groupDir: "workflows",
    definitionId,
    tomlFilename: "workflow.toml",
    markdownFilename: "WORKFLOW.md",
    definitionType: "workflow",
  });

  return {
    definition: validateWorkflowDefinition(files.toml, files.definitionId),
    instructions: files.markdown,
  };
};
