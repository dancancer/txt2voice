const SCRIPT_COVERAGE_PASS_THRESHOLD = 0.98;

const normalizeText = (value: string): string => value.replace(/\s+/g, "");

const toStableRatio = (value: number): number => Number(value.toFixed(4));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export interface ValidateStructuredOutputInput {
  value: unknown;
  requiredKeys: string[];
}

export interface ValidateStructuredOutputResult {
  valid: boolean;
  missingKeys: string[];
}

export interface CheckScriptCoverageInput {
  sourceText: string;
  scriptFragments: string[];
}

export interface CheckScriptCoverageResult {
  valid: boolean;
  coverageRatio: number;
  uncoveredChars: number;
}

const findBestCoverageMatchStart = (params: {
  source: string;
  fragment: string;
  coveredMask: boolean[];
}): number => {
  const { source, fragment, coveredMask } = params;
  let startIndex = source.indexOf(fragment);
  let bestStart = -1;
  let maxNewCoverage = 0;

  while (startIndex >= 0) {
    let newCoverage = 0;

    for (let index = startIndex; index < startIndex + fragment.length; index += 1) {
      if (!coveredMask[index]) {
        newCoverage += 1;
      }
    }

    const shouldReplaceBest =
      newCoverage > maxNewCoverage ||
      (newCoverage === maxNewCoverage && newCoverage > 0 && (bestStart < 0 || startIndex < bestStart));

    if (shouldReplaceBest) {
      bestStart = startIndex;
      maxNewCoverage = newCoverage;
    }

    startIndex = source.indexOf(fragment, startIndex + 1);
  }

  return bestStart;
};

export const validateStructuredOutput = (
  input: ValidateStructuredOutputInput
): ValidateStructuredOutputResult => {
  const { value, requiredKeys } = input;
  const record = isRecord(value) ? value : {};
  const missingKeys = requiredKeys.filter((key) => !(key in record));

  return {
    valid: missingKeys.length === 0,
    missingKeys,
  };
};

export const checkScriptCoverage = (
  input: CheckScriptCoverageInput
): CheckScriptCoverageResult => {
  const normalizedSource = normalizeText(input.sourceText);
  const totalChars = normalizedSource.length;

  if (totalChars === 0) {
    return {
      valid: true,
      coverageRatio: 1,
      uncoveredChars: 0,
    };
  }

  const coveredMask = new Array<boolean>(totalChars).fill(false);

  for (const fragment of input.scriptFragments) {
    const normalizedFragment = normalizeText(fragment);
    if (!normalizedFragment) {
      continue;
    }

    const startIndex = findBestCoverageMatchStart({
      source: normalizedSource,
      fragment: normalizedFragment,
      coveredMask,
    });
    if (startIndex < 0) {
      continue;
    }

    for (let index = startIndex; index < startIndex + normalizedFragment.length; index += 1) {
      coveredMask[index] = true;
    }
  }

  const coveredChars = coveredMask.filter(Boolean).length;
  const uncoveredChars = totalChars - coveredChars;
  const coverageRatio = toStableRatio(coveredChars / totalChars);

  return {
    valid: coverageRatio >= SCRIPT_COVERAGE_PASS_THRESHOLD,
    coverageRatio,
    uncoveredChars,
  };
};
