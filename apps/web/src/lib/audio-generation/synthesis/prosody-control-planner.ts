// 一旦我被更新，请更新我的开头注释
// input: 台词情绪/语气/朗读参数/provider hints
// output: provider scoped prosody controls
// pos: 音频生成韵律规划模块
import { normalizeNumber } from "./tts-parameter-normalizer";

export interface ProsodyIntentInput {
  tone?: string | null;
  emotionLabel?: string | null;
  emotionIntensity?: unknown;
  prosody?: unknown;
  ttsParameters?: unknown;
  requestOverrides?: Record<string, unknown>;
  defaultParameters?: Record<string, unknown>;
}

export interface VoxCPMProsodyParams {
  controlInstruction?: string;
  cfgValue?: number;
  inferenceTimesteps?: number;
  normalize?: boolean;
  denoise?: boolean;
}

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const asPlainRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const firstFinite = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const normalized = normalizeNumber(value, Number.NaN);
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }
  return undefined;
};

const firstBoolean = (...values: unknown[]): boolean | undefined => {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
};

const describeEmotion = ({
  tone,
  emotionLabel,
  emotionIntensity,
}: ProsodyIntentInput): string | undefined => {
  const emotion = firstString(emotionLabel, tone);
  const intensity = firstFinite(emotionIntensity);

  if (!emotion) {
    return undefined;
  }

  if (intensity === undefined) {
    return `情绪偏 ${emotion}`;
  }

  return `情绪偏 ${emotion}，强度 ${Math.round(intensity * 100)}%`;
};

export const planVoxCPMProsodyParams = (
  input: ProsodyIntentInput
): VoxCPMProsodyParams => {
  const requestOverrides = input.requestOverrides || {};
  const ttsParameters = asPlainRecord(input.ttsParameters) || {};
  const ttsHints = asPlainRecord(ttsParameters.ttsHints) || {};
  const prosody = asPlainRecord(input.prosody) || {};
  const defaultParameters = input.defaultParameters || {};
  const controlInstruction = firstString(
    requestOverrides.controlInstruction,
    ttsHints.controlInstruction,
    prosody.controlInstruction,
    ttsParameters.controlInstruction,
    defaultParameters.controlInstruction
  );
  const generatedInstruction =
    controlInstruction ||
    describeEmotion(input) ||
    firstString(input.tone) ||
    undefined;

  return {
    ...(generatedInstruction
      ? { controlInstruction: generatedInstruction }
      : {}),
    ...(firstFinite(
      requestOverrides.cfgValue,
      ttsHints.cfgValue,
      ttsHints.cfg_value,
      prosody.cfgValue,
      prosody.cfg_value,
      ttsParameters.cfgValue,
      ttsParameters.cfg_value,
      defaultParameters.cfgValue,
      defaultParameters.cfg_value
    ) !== undefined
      ? {
          cfgValue: firstFinite(
            requestOverrides.cfgValue,
            ttsHints.cfgValue,
            ttsHints.cfg_value,
            prosody.cfgValue,
            prosody.cfg_value,
            ttsParameters.cfgValue,
            ttsParameters.cfg_value,
            defaultParameters.cfgValue,
            defaultParameters.cfg_value
          ),
        }
      : {}),
    ...(firstFinite(
      requestOverrides.inferenceTimesteps,
      ttsHints.inferenceTimesteps,
      ttsHints.inference_timesteps,
      prosody.inferenceTimesteps,
      prosody.inference_timesteps,
      ttsParameters.inferenceTimesteps,
      ttsParameters.inference_timesteps,
      defaultParameters.inferenceTimesteps,
      defaultParameters.inference_timesteps
    ) !== undefined
      ? {
          inferenceTimesteps: firstFinite(
            requestOverrides.inferenceTimesteps,
            ttsHints.inferenceTimesteps,
            ttsHints.inference_timesteps,
            prosody.inferenceTimesteps,
            prosody.inference_timesteps,
            ttsParameters.inferenceTimesteps,
            ttsParameters.inference_timesteps,
            defaultParameters.inferenceTimesteps,
            defaultParameters.inference_timesteps
          ),
        }
      : {}),
    ...(firstBoolean(requestOverrides.normalize, ttsHints.normalize, prosody.normalize)
      !== undefined
      ? {
          normalize: firstBoolean(
            requestOverrides.normalize,
            ttsHints.normalize,
            prosody.normalize
          ),
        }
      : {}),
    ...(firstBoolean(requestOverrides.denoise, ttsHints.denoise, prosody.denoise)
      !== undefined
      ? {
          denoise: firstBoolean(
            requestOverrides.denoise,
            ttsHints.denoise,
            prosody.denoise
          ),
        }
      : {}),
  };
};
