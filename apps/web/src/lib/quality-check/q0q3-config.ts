import type {
  MetadataSource,
  Q0Q3ProviderConfig,
  Q0Q3SignalSourceResolution,
  Q0Q3ThresholdResolution,
  Q0Q3ThresholdTemplate,
  SignalProvider,
} from "@/lib/quality-check/q0q3-types";
import {
  DEFAULT_Q0Q3_THRESHOLD_TEMPLATE,
  DEFAULT_SIGNAL_SOURCES,
} from "@/lib/quality-check/q0q3-types";

const SIGNAL_PROVIDER_SET = new Set<SignalProvider>([
  "heuristic",
  "attempt_metrics",
  "task_payload",
]);

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

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const resolveProviders = (
  value: unknown,
  defaults: SignalProvider[]
): SignalProvider[] => {
  const toProvider = (entry: string): string => {
    if (entry === "metrics") return "attempt_metrics";
    if (entry === "payload") return "task_payload";
    return entry;
  };

  if (Array.isArray(value)) {
    const parsed = value
      .map((entry) => asString(entry)?.toLowerCase())
      .filter((entry): entry is string => Boolean(entry))
      .map(toProvider)
      .filter((entry): entry is SignalProvider =>
        SIGNAL_PROVIDER_SET.has(entry as SignalProvider)
      );
    const deduped = Array.from(new Set(parsed));
    return deduped.length > 0 ? deduped : defaults;
  }

  if (typeof value === "string") {
    const parsed = value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
      .map(toProvider)
      .filter((entry): entry is SignalProvider =>
        SIGNAL_PROVIDER_SET.has(entry as SignalProvider)
      );
    const deduped = Array.from(new Set(parsed));
    return deduped.length > 0 ? deduped : defaults;
  }

  return defaults;
};

const parseSignalSourceConfig = (value: unknown): Q0Q3ProviderConfig | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value) || typeof value === "string") {
    const providers = resolveProviders(value, DEFAULT_SIGNAL_SOURCES.q2);
    return {
      q0: [...DEFAULT_SIGNAL_SOURCES.q0],
      q1: [...DEFAULT_SIGNAL_SOURCES.q1],
      q2: providers,
      q3: providers,
    };
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const q2Source = record.q2 || record.cer || record.text || record.q2Cer;
  const q3Source = record.q3 || record.speaker || record.q3Speaker;

  return {
    q0: resolveProviders(record.q0, DEFAULT_SIGNAL_SOURCES.q0),
    q1: resolveProviders(record.q1, DEFAULT_SIGNAL_SOURCES.q1),
    q2: resolveProviders(q2Source, DEFAULT_SIGNAL_SOURCES.q2),
    q3: resolveProviders(q3Source, DEFAULT_SIGNAL_SOURCES.q3),
  };
};

const parseThresholdTemplate = (
  value: unknown
): Partial<Q0Q3ThresholdTemplate> | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const maybeNumber = (key: string): number | undefined => {
    const parsed = asNumber(record[key]);
    return parsed === null ? undefined : parsed;
  };

  return {
    q0PassScore: maybeNumber("q0PassScore"),
    q0ManualReviewScore: maybeNumber("q0ManualReviewScore"),
    q0MaxTextLength: maybeNumber("q0MaxTextLength"),
    q1PassScore: maybeNumber("q1PassScore"),
    q1ManualReviewScore: maybeNumber("q1ManualReviewScore"),
    q1HardFailCharsPerSecond: maybeNumber("q1HardFailCharsPerSecond"),
    q1LeadingSilenceMsMax: maybeNumber("q1LeadingSilenceMsMax"),
    q1TrailingSilenceMsMax: maybeNumber("q1TrailingSilenceMsMax"),
    q1LufsTarget: maybeNumber("q1LufsTarget"),
    q1LufsTolerance: maybeNumber("q1LufsTolerance"),
    q2CerNarrationPass: maybeNumber("q2CerNarrationPass"),
    q2CerDialoguePass: maybeNumber("q2CerDialoguePass"),
    q2CerHighEmotionPass: maybeNumber("q2CerHighEmotionPass"),
    q2CerManualReviewDelta: maybeNumber("q2CerManualReviewDelta"),
    q2CerHardFail: maybeNumber("q2CerHardFail"),
    q3SpeakerLeadPass: maybeNumber("q3SpeakerLeadPass"),
    q3SpeakerSupportPass: maybeNumber("q3SpeakerSupportPass"),
    q3SpeakerManualReviewGap: maybeNumber("q3SpeakerManualReviewGap"),
    q3SpeakerHardFail: maybeNumber("q3SpeakerHardFail"),
    fastPassScore: maybeNumber("fastPassScore"),
    fastManualReviewScore: maybeNumber("fastManualReviewScore"),
  };
};

const mergeThresholdTemplate = (
  base: Q0Q3ThresholdTemplate,
  override: Partial<Q0Q3ThresholdTemplate> | null
): Q0Q3ThresholdTemplate => {
  if (!override) {
    return base;
  }

  const merged: Q0Q3ThresholdTemplate = { ...base };
  for (const key of Object.keys(override) as Array<keyof Q0Q3ThresholdTemplate>) {
    const value = override[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      merged[key] = value;
    }
  }
  return merged;
};

const readQualityCheckMetadata = (metadata: unknown): Record<string, unknown> => {
  const root = asRecord(metadata);
  const qualityCheck = asRecord(root?.qualityCheck);
  return qualityCheck || {};
};

export const resolveQ0Q3SignalSources = ({
  taskMetadata,
  bookMetadata,
}: {
  taskMetadata?: Record<string, unknown> | null;
  bookMetadata?: unknown;
}): Q0Q3SignalSourceResolution => {
  const qualityCheckMetadata = readQualityCheckMetadata(bookMetadata);
  const bookConfig = parseSignalSourceConfig(
    qualityCheckMetadata.signalSources || qualityCheckMetadata.q0q3SignalSources
  );
  const taskConfig = parseSignalSourceConfig(
    taskMetadata?.signalSources || taskMetadata?.q0q3SignalSources
  );

  if (taskConfig) return { config: taskConfig, source: "task_override" };
  if (bookConfig) return { config: bookConfig, source: "book_metadata" };
  return { config: { ...DEFAULT_SIGNAL_SOURCES }, source: "default" };
};

export const resolveQ0Q3ThresholdTemplate = ({
  taskMetadata,
  bookMetadata,
}: {
  taskMetadata?: Record<string, unknown> | null;
  bookMetadata?: unknown;
}): Q0Q3ThresholdResolution => {
  const qualityCheckMetadata = readQualityCheckMetadata(bookMetadata);
  const bookTemplate = parseThresholdTemplate(
    qualityCheckMetadata.q0q3Thresholds || qualityCheckMetadata.fastGateThresholds
  );
  const taskTemplate = parseThresholdTemplate(
    taskMetadata?.q0q3Thresholds || taskMetadata?.fastGateThresholds
  );

  return {
    template: mergeThresholdTemplate(
      mergeThresholdTemplate(DEFAULT_Q0Q3_THRESHOLD_TEMPLATE, bookTemplate),
      taskTemplate
    ),
    source: (taskTemplate
      ? "task_override"
      : bookTemplate
        ? "book_metadata"
        : "default") as MetadataSource,
  };
};
