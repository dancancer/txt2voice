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

export const applyReferenceMemoryBudget = (
  input: ReferenceBudgetInput
): ReferenceBudgetResult => {
  const { budget, inputContextChars, referenceCandidate } = input;
  const maxContextChars = clampNonNegative(budget.maxContextChars);
  const reservedOutputChars = clampNonNegative(budget.reservedOutputChars);
  const safeInputChars = clampNonNegative(inputContextChars);
  const inputBudgetLimit = Math.max(maxContextChars - reservedOutputChars, 0);
  const inputOverBudget = safeInputChars > inputBudgetLimit;
  const remainingReferenceChars = Math.max(
    inputBudgetLimit - safeInputChars,
    0
  );

  return {
    remainingReferenceChars,
    trimmedReferenceMemory: referenceCandidate.slice(0, remainingReferenceChars),
    inputOverBudget,
  };
};
