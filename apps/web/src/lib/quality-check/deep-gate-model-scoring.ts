// 一旦我被更新，请更新我的开头注释
// input: 模型响应 payload
// output: Deep Gate 可用评分信号
// pos: Deep Gate 模型评分解析模块

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const clampUnit = (value: number): number => {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
};

const parseScoreMap = (value: unknown): Record<string, number> => {
  const mapValue = asRecord(value);
  if (mapValue) {
    return Object.entries(mapValue).reduce<Record<string, number>>((acc, entry) => {
      const [label, scoreValue] = entry;
      const score = asNumber(scoreValue);
      if (score === undefined) {
        return acc;
      }
      acc[label.trim().toLowerCase()] = clampUnit(score);
      return acc;
    }, {});
  }

  if (!Array.isArray(value)) {
    return {};
  }

  const fromArray: Record<string, number> = {};
  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const label = asString(record.label || record.emotion || record.name);
    const score = asNumber(record.score || record.probability || record.value);
    if (!label || score === undefined) {
      continue;
    }

    fromArray[label.toLowerCase()] = clampUnit(score);
  }

  return fromArray;
};

const parseNumericVector = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const numbers = value
    .map((entry) => asNumber(entry))
    .filter((entry): entry is number => entry !== undefined);

  return numbers.length > 0 ? numbers : [];
};

const cosineSimilarity = (left: number[], right: number[]): number | null => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return null;
  }

  let dot = 0;
  let normLeft = 0;
  let normRight = 0;

  for (let index = 0; index < left.length; index += 1) {
    const lv = left[index];
    const rv = right[index];
    dot += lv * rv;
    normLeft += lv * lv;
    normRight += rv * rv;
  }

  if (normLeft <= 0 || normRight <= 0) {
    return null;
  }

  return clampUnit((dot / Math.sqrt(normLeft * normRight) + 1) / 2);
};

export const parseModelResponse = (value: unknown): Record<string, unknown> | null => {
  const direct = asRecord(value);
  if (!direct) {
    return null;
  }

  const nestedData = asRecord(direct.data);
  if (!nestedData) {
    return direct;
  }

  return {
    ...direct,
    ...nestedData,
  };
};

export const resolveEmotionModelScore = ({
  response,
  expectedEmotion,
}: {
  response: Record<string, unknown>;
  expectedEmotion: string;
}): {
  score: number;
  reasons: string[];
  diagnostics: Record<string, unknown>;
} | null => {
  const scoreMap = parseScoreMap(
    response.scores || response.probabilities || response.labels
  );

  const topLabelFromPayload =
    asString(response.predictedLabel) ||
    asString(response.topLabel) ||
    asString(response.label);
  const topScoreFromPayload = asNumber(
    response.topScore || response.probability || response.confidence
  );
  const targetScoreFromPayload = asNumber(
    response.targetScore || response.expectedScore || response.matchScore
  );

  const scoreEntries = Object.entries(scoreMap).sort((left, right) => right[1] - left[1]);
  const topEntry = scoreEntries[0];

  const topLabel =
    topLabelFromPayload?.toLowerCase() || (topEntry ? topEntry[0] : undefined);
  const topScore = clampUnit(topScoreFromPayload ?? (topEntry ? topEntry[1] : 0));

  const expectedScoreFromMap = scoreMap[expectedEmotion];
  const targetScore = clampUnit(
    targetScoreFromPayload ??
      expectedScoreFromMap ??
      (topLabel === expectedEmotion ? topScore : Number.NaN)
  );

  if (!Number.isFinite(targetScore)) {
    return null;
  }

  const confidence = clampUnit(asNumber(response.confidence) ?? topScore);
  const reasons: string[] = [];

  if (targetScore < 0.36) {
    reasons.push("emotion_mismatch_hard");
  } else if (targetScore < 0.55) {
    reasons.push("emotion_mismatch");
  }

  if (topLabel && topLabel !== expectedEmotion && topScore - targetScore >= 0.22) {
    reasons.push("emotion_label_shift");
  }

  if (confidence < 0.35) {
    reasons.push("emotion_model_low_confidence");
  }

  return {
    score: clampScore(targetScore * 100),
    reasons,
    diagnostics: {
      expectedEmotion,
      targetScore,
      topLabel: topLabel || null,
      topScore,
      confidence,
      scoreMapSize: Object.keys(scoreMap).length,
    },
  };
};

export const resolveContinuityModelScore = ({
  response,
}: {
  response: Record<string, unknown>;
}): {
  score: number;
  reasons: string[];
  diagnostics: Record<string, unknown>;
} | null => {
  const similarityFromPayload = asNumber(
    response.similarity || response.consistency || response.cosineSimilarity
  );
  const driftFromPayload = asNumber(response.drift || response.driftScore);
  const confidence = clampUnit(asNumber(response.confidence) ?? 0.8);

  const sampleEmbedding = parseNumericVector(
    response.embedding || response.sampleEmbedding
  );
  const chapterEmbedding = parseNumericVector(
    response.chapterEmbedding || response.referenceEmbedding
  );
  const embeddingSimilarity = cosineSimilarity(sampleEmbedding, chapterEmbedding);

  const similarityCandidate =
    similarityFromPayload ??
    (driftFromPayload !== undefined ? 1 - clampUnit(driftFromPayload) : Number.NaN);
  const similarity = clampUnit(similarityCandidate);
  const resolvedSimilarity = Number.isFinite(similarity)
    ? similarity
    : embeddingSimilarity;

  if (resolvedSimilarity === null || !Number.isFinite(resolvedSimilarity)) {
    return null;
  }

  const reasons: string[] = [];
  if (resolvedSimilarity < 0.42) {
    reasons.push("chapter_embedding_drift_high");
  } else if (resolvedSimilarity < 0.6) {
    reasons.push("chapter_embedding_drift");
  }

  if (confidence < 0.35) {
    reasons.push("continuity_model_low_confidence");
  }

  return {
    score: clampScore(resolvedSimilarity * 100),
    reasons,
    diagnostics: {
      similarity: resolvedSimilarity,
      confidence,
      usedEmbeddingSimilarity: embeddingSimilarity !== null && !Number.isFinite(similarity),
      embeddingDimensions:
        sampleEmbedding.length > 0 && sampleEmbedding.length === chapterEmbedding.length
          ? sampleEmbedding.length
          : 0,
    },
  };
};
