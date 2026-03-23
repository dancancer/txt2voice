import fs from "fs";
import os from "os";
import path from "path";

import {
  DefinitionRegistryError,
  loadAgentDefinition,
  loadSkillDefinition,
  loadWorkflowDefinition,
} from "../registry";

const writeFile = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
};

const createFixtureRoot = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "definition-loader-"));

  writeFile(
    path.join(rootDir, "agents/character-discovery/agent.toml"),
    [
      'id = "character-discovery"',
      'version = "1"',
      'role = "discover_character_identities"',
      'compatibleWorkflowStages = ["character_discovery"]',
      'allowedSkills = ["character-extraction"]',
      'allowedTools = ["load-book-context"]',
    ].join("\n")
  );
  writeFile(
    path.join(rootDir, "agents/character-discovery/AGENT.md"),
    "# Character Discovery\n"
  );

  writeFile(
    path.join(rootDir, "skills/character-extraction/skill.toml"),
    [
      'id = "character-extraction"',
      'version = "1"',
      'kind = "analysis"',
      'compatibleAgents = ["character-discovery"]',
      'inputSchemaRef = "character-input"',
      'outputSchemaRef = "character-output"',
      'contextRequirements = ["segment"]',
      'toolAllowlist = ["load-book-context"]',
    ].join("\n")
  );
  writeFile(
    path.join(rootDir, "skills/character-extraction/SKILL.md"),
    "# Character Extraction\n"
  );

  writeFile(
    path.join(rootDir, "workflows/script-production/workflow.toml"),
    [
      'id = "script-production"',
      'version = "1"',
      'kind = "workflow"',
      'stages = ["prepare", "character_discovery", "segment_scripting"]',
    ].join("\n")
  );
  writeFile(
    path.join(rootDir, "workflows/script-production/WORKFLOW.md"),
    "# Script Production\n"
  );

  return rootDir;
};

describe("definition loader", () => {
  it("loads agent, skill, and workflow definitions from the filesystem", () => {
    const rootDir = createFixtureRoot();

    const agent = loadAgentDefinition(rootDir, "character-discovery");
    const skill = loadSkillDefinition(rootDir, "character-extraction");
    const workflow = loadWorkflowDefinition(rootDir, "script-production");

    expect(agent.definition.id).toBe("character-discovery");
    expect(agent.instructions).toContain("Character Discovery");

    expect(skill.definition.id).toBe("character-extraction");
    expect(skill.instructions).toContain("Character Extraction");

    expect(workflow.definition.id).toBe("script-production");
    expect(workflow.instructions).toContain("Script Production");
  });

  it("raises a structured validation error when required toml fields are missing", () => {
    const rootDir = createFixtureRoot();

    writeFile(
      path.join(rootDir, "agents/character-discovery/agent.toml"),
      ['id = "character-discovery"', 'version = "1"'].join("\n")
    );

    expect(() => loadAgentDefinition(rootDir, "character-discovery")).toThrow(
      DefinitionRegistryError
    );

    try {
      loadAgentDefinition(rootDir, "character-discovery");
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionRegistryError);
      expect((error as DefinitionRegistryError).code).toBe("VALIDATION_ERROR");
      expect((error as DefinitionRegistryError).details).toMatchObject({
        definitionType: "agent",
        definitionId: "character-discovery",
        missingFields: ["role", "compatibleWorkflowStages", "allowedSkills", "allowedTools"],
      });
    }
  });

  it("raises a structured validation error when required skill toml fields are missing", () => {
    const rootDir = createFixtureRoot();

    writeFile(
      path.join(rootDir, "skills/character-extraction/skill.toml"),
      ['id = "character-extraction"', 'version = "1"'].join("\n")
    );

    expect(() => loadSkillDefinition(rootDir, "character-extraction")).toThrow(
      DefinitionRegistryError
    );

    try {
      loadSkillDefinition(rootDir, "character-extraction");
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionRegistryError);
      expect((error as DefinitionRegistryError).code).toBe("VALIDATION_ERROR");
      expect((error as DefinitionRegistryError).details).toMatchObject({
        definitionType: "skill",
        definitionId: "character-extraction",
        missingFields: [
          "kind",
          "compatibleAgents",
          "inputSchemaRef",
          "outputSchemaRef",
          "contextRequirements",
          "toolAllowlist",
        ],
      });
    }
  });

  it("raises an authoring error when required markdown files are missing", () => {
    const rootDir = createFixtureRoot();

    fs.rmSync(
      path.join(rootDir, "skills/character-extraction/SKILL.md")
    );

    expect(() => loadSkillDefinition(rootDir, "character-extraction")).toThrow(
      DefinitionRegistryError
    );

    try {
      loadSkillDefinition(rootDir, "character-extraction");
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionRegistryError);
      expect((error as DefinitionRegistryError).code).toBe("AUTHORING_ERROR");
      expect((error as DefinitionRegistryError).details).toMatchObject({
        definitionType: "skill",
        definitionId: "character-extraction",
        missingFile: "SKILL.md",
      });
    }
  });

  it("raises an authoring error when AGENT.md is missing", () => {
    const rootDir = createFixtureRoot();

    fs.rmSync(path.join(rootDir, "agents/character-discovery/AGENT.md"));

    expect(() => loadAgentDefinition(rootDir, "character-discovery")).toThrow(
      DefinitionRegistryError
    );

    try {
      loadAgentDefinition(rootDir, "character-discovery");
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionRegistryError);
      expect((error as DefinitionRegistryError).code).toBe("AUTHORING_ERROR");
      expect((error as DefinitionRegistryError).details).toMatchObject({
        definitionType: "agent",
        definitionId: "character-discovery",
        missingFile: "AGENT.md",
      });
    }
  });

  it("raises an authoring error when WORKFLOW.md is missing", () => {
    const rootDir = createFixtureRoot();

    fs.rmSync(path.join(rootDir, "workflows/script-production/WORKFLOW.md"));

    expect(() => loadWorkflowDefinition(rootDir, "script-production")).toThrow(
      DefinitionRegistryError
    );

    try {
      loadWorkflowDefinition(rootDir, "script-production");
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionRegistryError);
      expect((error as DefinitionRegistryError).code).toBe("AUTHORING_ERROR");
      expect((error as DefinitionRegistryError).details).toMatchObject({
        definitionType: "workflow",
        definitionId: "script-production",
        missingFile: "WORKFLOW.md",
      });
    }
  });
});
