import type { ContextBudget } from "../context";
import { resolveInputBudgetLimit } from "../context/budget-policy";

export interface FitPromptToBudgetInput {
  systemPrompt: string;
  maxPromptChars: number;
  variables: Record<string, string>;
  trimOrder: string[];
  renderPrompt: (variables: Record<string, string>) => string;
}

export interface FitPromptToBudgetResult {
  prompt: string;
  promptChars: number;
  originalPromptChars: number;
  overBudget: boolean;
  variables: Record<string, string>;
  trimmedKeys: string[];
}

export const measurePromptChars = (params: {
  systemPrompt: string;
  prompt: string;
}) => params.systemPrompt.length + params.prompt.length;

export const resolvePromptBudgetLimit = (budget: ContextBudget) =>
  resolveInputBudgetLimit(budget);

export const preservePromptValueEdges = (
  value: string,
  targetLength: number
): string => {
  if (targetLength <= 0) {
    return "";
  }

  if (value.length <= targetLength) {
    return value;
  }

  if (targetLength <= 8) {
    return value.slice(0, targetLength);
  }

  const separator = "\n...\n";
  const contentLength = Math.max(targetLength - separator.length, 2);
  const headLength = Math.ceil(contentLength / 2);
  const tailLength = Math.floor(contentLength / 2);

  return `${value.slice(0, headLength)}${separator}${value.slice(
    value.length - tailLength
  )}`;
};

export const fitPromptToBudget = (
  input: FitPromptToBudgetInput
): FitPromptToBudgetResult => {
  const variables = { ...input.variables };
  const originalPrompt = input.renderPrompt(variables);
  const originalPromptChars = measurePromptChars({
    systemPrompt: input.systemPrompt,
    prompt: originalPrompt,
  });

  let prompt = originalPrompt;
  let promptChars = originalPromptChars;
  const trimmedKeys: string[] = [];

  for (const key of input.trimOrder) {
    if (promptChars <= input.maxPromptChars) {
      break;
    }

    const currentValue = variables[key] ?? "";
    if (currentValue.length === 0) {
      continue;
    }

    const overflow = promptChars - input.maxPromptChars;
    const nextLength = Math.max(0, currentValue.length - overflow);
    if (nextLength >= currentValue.length) {
      continue;
    }

    variables[key] = currentValue.slice(0, nextLength);
    trimmedKeys.push(key);
    prompt = input.renderPrompt(variables);
    promptChars = measurePromptChars({
      systemPrompt: input.systemPrompt,
      prompt,
    });
  }

  return {
    prompt,
    promptChars,
    originalPromptChars,
    overBudget: promptChars > input.maxPromptChars,
    variables,
    trimmedKeys,
  };
};
