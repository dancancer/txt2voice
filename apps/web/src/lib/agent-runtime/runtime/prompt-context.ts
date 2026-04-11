const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const measureJsonChars = (value: unknown): number => JSON.stringify(value).length;

const fitJsonStringValue = (
  value: string,
  maxChars: number
): string | undefined => {
  if (maxChars < 2) {
    return undefined;
  }

  if (measureJsonChars(value) <= maxChars) {
    return value;
  }

  let nextLength = Math.max(0, maxChars - 2);
  while (nextLength >= 0) {
    const candidate = value.slice(0, nextLength);
    if (measureJsonChars(candidate) <= maxChars) {
      return candidate;
    }
    nextLength -= 1;
  }

  return "";
};

const fitJsonValueToBudget = (
  value: unknown,
  maxChars: number
): unknown | undefined => {
  if (maxChars <= 0) {
    return undefined;
  }

  if (measureJsonChars(value) <= maxChars) {
    return value;
  }

  if (typeof value === "string") {
    return fitJsonStringValue(value, maxChars);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const fittedItems: unknown[] = [];
    if (measureJsonChars(fittedItems) > maxChars) {
      return undefined;
    }

    for (const item of value) {
      const withFullItem = [...fittedItems, item];
      if (measureJsonChars(withFullItem) <= maxChars) {
        fittedItems.push(item);
        continue;
      }

      const fittedItem = fitJsonValueToBudget(item, maxChars);
      if (fittedItem !== undefined) {
        const withFittedItem = [...fittedItems, fittedItem];
        if (measureJsonChars(withFittedItem) <= maxChars) {
          fittedItems.push(fittedItem);
        }
      }
      break;
    }

    return fittedItems;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const fittedObject: Record<string, unknown> = {};
  if (measureJsonChars(fittedObject) > maxChars) {
    return undefined;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    const withFullEntry = {
      ...fittedObject,
      [key]: entryValue,
    };
    if (measureJsonChars(withFullEntry) <= maxChars) {
      fittedObject[key] = entryValue;
      continue;
    }

    const fittedEntryValue = fitJsonValueToBudget(entryValue, maxChars);
    if (fittedEntryValue !== undefined) {
      const withFittedEntry = {
        ...fittedObject,
        [key]: fittedEntryValue,
      };
      if (measureJsonChars(withFittedEntry) <= maxChars) {
        fittedObject[key] = fittedEntryValue;
      }
    }
    break;
  }

  return fittedObject;
};

export type ResolvedPromptVariableStrategy =
  | "truncate"
  | "preserve_edges"
  | "json_summary"
  | "json_fit";

export const isStructuredJsonText = (value: string): boolean => {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) || Array.isArray(parsed);
  } catch {
    return false;
  }
};

export const fitJsonTextToPromptBudget = (
  value: string,
  maxChars: number
): string => {
  if (maxChars <= 0) {
    return "";
  }

  if (value.length <= maxChars) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    const fitted = fitJsonValueToBudget(parsed, maxChars);
    return fitted === undefined ? "" : JSON.stringify(fitted, null, 2);
  } catch {
    return value.slice(0, maxChars);
  }
};

export const resolvePromptVariableStrategy = (params: {
  value: string;
  explicitStrategy?: ResolvedPromptVariableStrategy;
}): ResolvedPromptVariableStrategy => {
  if (params.explicitStrategy) {
    return params.explicitStrategy;
  }

  return isStructuredJsonText(params.value) ? "json_fit" : "truncate";
};
