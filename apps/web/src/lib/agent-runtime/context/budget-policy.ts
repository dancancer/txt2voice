export interface ContextBudget {
  maxContextChars: number;
  reservedOutputChars: number;
}

export interface ReferenceBudgetInput {
  budget: ContextBudget;
  inputContextChars: number;
  referenceCandidate: string;
}

export interface ReferenceBudgetResult {
  remainingReferenceChars: number;
  trimmedReferenceMemory: string;
  inputOverBudget: boolean;
}

const clampNonNegative = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

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

/* ---------- 保持参考记忆始终为合法 JSON，避免把半截字符串喂进 prompt ---------- */
const fitJsonTextToBudget = (value: string, maxChars: number): string => {
  if (maxChars <= 0) {
    return "";
  }

  if (value.length <= maxChars) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    const fitted = fitJsonValueToBudget(parsed, maxChars);
    return fitted === undefined ? "" : JSON.stringify(fitted);
  } catch {
    return value.slice(0, maxChars);
  }
};

export const resolveInputBudgetLimit = (budget: ContextBudget): number => {
  const maxContextChars = clampNonNegative(budget.maxContextChars);
  const reservedOutputChars = clampNonNegative(budget.reservedOutputChars);

  return Math.max(maxContextChars - reservedOutputChars, 0);
};

export const applyReferenceMemoryBudget = (
  input: ReferenceBudgetInput
): ReferenceBudgetResult => {
  const { budget, inputContextChars, referenceCandidate } = input;
  const safeInputChars = clampNonNegative(inputContextChars);
  const inputBudgetLimit = resolveInputBudgetLimit(budget);
  const inputOverBudget = safeInputChars > inputBudgetLimit;
  const remainingReferenceChars = Math.max(
    inputBudgetLimit - safeInputChars,
    0
  );

  return {
    remainingReferenceChars,
    trimmedReferenceMemory: fitJsonTextToBudget(
      referenceCandidate,
      remainingReferenceChars
    ),
    inputOverBudget,
  };
};
