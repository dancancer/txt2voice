// 一旦我被更新，请更新我的开头注释
// input: preset id
// output: 自动编排稳定选项快照
// pos: 自动编排预设模块
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";

export const ZERO_TOUCH_VOXCPM_PRESET_ID = "zero_touch_voxcpm";
export const ZERO_TOUCH_VOXCPM_PRESET_VERSION = "zero_touch_voxcpm@1";

export interface ResolvedAutoPipelinePreset {
  presetId: string;
  presetVersion: string;
  resolvedOptions: AutoPipelineOptions;
}

type PresetAudioOptions = NonNullable<
  NonNullable<AutoPipelineOptions["audioGeneration"]>["options"]
>;

const sanitizeAudioOptions = (options?: PresetAudioOptions) => {
  if (!options || typeof options !== "object") {
    return options;
  }

  const { preferredProvider, ...rest } = options as Record<string, unknown>;
  const sanitized = { ...rest };
  if (preferredProvider === "voxcpm") {
    sanitized.preferredProvider = "voxcpm";
  }

  return sanitized as PresetAudioOptions;
};

const sanitizeOptions = (options: AutoPipelineOptions): AutoPipelineOptions => ({
  ...options,
  ...(options.audioGeneration
    ? {
        audioGeneration: {
          ...options.audioGeneration,
          options: sanitizeAudioOptions(options.audioGeneration.options),
        },
      }
    : {}),
});

export const resolveAutoPipelinePreset = (
  presetId: string
): ResolvedAutoPipelinePreset => {
  if (presetId !== ZERO_TOUCH_VOXCPM_PRESET_ID) {
    throw new Error(`未知自动编排预设: ${presetId}`);
  }

  return {
    presetId,
    presetVersion: ZERO_TOUCH_VOXCPM_PRESET_VERSION,
    resolvedOptions: {
      audioGeneration: {
        autoMerge: false,
        options: {
          preferredProvider: "voxcpm",
          skipExisting: true,
        },
      },
      qualityCheck: {
        enabled: true,
      },
    },
  };
};

export const resolveAutoPipelineOptionsSnapshot = (
  presetId: string,
  options: AutoPipelineOptions = {}
): ResolvedAutoPipelinePreset => {
  const preset = resolveAutoPipelinePreset(presetId);
  const sanitizedOptions = sanitizeOptions(options);

  return {
    ...preset,
    resolvedOptions: {
      ...preset.resolvedOptions,
      ...sanitizedOptions,
      audioGeneration: {
        ...preset.resolvedOptions.audioGeneration,
        ...sanitizedOptions.audioGeneration,
        options: {
          ...preset.resolvedOptions.audioGeneration?.options,
          ...sanitizedOptions.audioGeneration?.options,
        },
      },
      qualityCheck: {
        ...preset.resolvedOptions.qualityCheck,
        ...sanitizedOptions.qualityCheck,
      },
    },
  };
};
