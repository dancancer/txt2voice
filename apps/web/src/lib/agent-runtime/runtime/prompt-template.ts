const PROMPT_PLACEHOLDER_PATTERN = /\{\{([a-z0-9_]+)\}\}/gi;

export type PromptTemplateVariables = Record<string, string>;

const hasOwn = (value: Record<string, string>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const renderPromptTemplate = (
  template: string,
  variables: PromptTemplateVariables
): string =>
  template.replace(PROMPT_PLACEHOLDER_PATTERN, (placeholder, rawKey) => {
    const key = rawKey.trim();
    if (!hasOwn(variables, key)) {
      return "";
    }

    return variables[key] ?? "";
  });
