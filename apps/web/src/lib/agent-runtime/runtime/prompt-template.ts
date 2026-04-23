const PROMPT_PLACEHOLDER_PATTERN = /\{\{([a-z0-9_]+)\}\}/gi;

export type PromptTemplateVariables = Record<string, string>;

const hasOwn = (value: Record<string, string>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const renderPromptTemplate = (
  template: string,
  variables: PromptTemplateVariables
): string => {
  const missingKeys = new Set<string>();
  const rendered = template.replace(
    PROMPT_PLACEHOLDER_PATTERN,
    (placeholder, rawKey) => {
      const key = rawKey.trim();
      if (!hasOwn(variables, key)) {
        missingKeys.add(key);
        return "";
      }

      return variables[key] ?? "";
    }
  );

  if (missingKeys.size > 0) {
    throw new Error(
      `Missing prompt template variables: ${[...missingKeys].join(", ")}`
    );
  }

  return rendered;
};
