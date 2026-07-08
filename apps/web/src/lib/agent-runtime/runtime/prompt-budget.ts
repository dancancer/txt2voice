import type { ContextBudget } from "../context";
import { resolveInputBudgetLimit } from "../context/budget-policy";
import { summarizePromptArtifact } from "./prompt-artifact-summary";
import {
  fitJsonTextToPromptBudget,
  resolvePromptVariableStrategy,
} from "./prompt-context";

export type PromptVariableStrategy =
  | "truncate"
  | "preserve_edges"
  | "json_summary"
  | "json_fit";

export interface FitPromptToBudgetInput {
  systemPrompt: string;
  maxPromptChars: number;
  variables: Record<string, string>;
  trimOrder: string[];
  renderPrompt: (variables: Record<string, string>) => string;
  variableStrategies?: Partial<Record<string, PromptVariableStrategy>>;
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

  const applyVariableStrategy = (
    key: string,
    value: string,
    targetLength: number
  ): string => {
    const strategy = resolvePromptVariableStrategy({
      value,
      explicitStrategy: input.variableStrategies?.[key],
    });

    if (strategy === "preserve_edges") {
      return preservePromptValueEdges(value, targetLength);
    }

    if (strategy === "json_fit") {
      return fitJsonTextToPromptBudget(value, targetLength);
    }

    if (strategy === "json_summary") {
      try {
        const parsed = JSON.parse(value);
        const summary = summarizePromptArtifact(parsed);
        return fitJsonTextToPromptBudget(
          JSON.stringify(summary ?? null, null, 2),
          targetLength
        );
      } catch {
        return preservePromptValueEdges(value, targetLength);
      }
    }

    return value.slice(0, targetLength);
  };

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

    variables[key] = applyVariableStrategy(key, currentValue, nextLength);
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
