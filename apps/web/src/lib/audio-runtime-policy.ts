// 一旦我被更新，请更新我的开头注释
// input: provider 名称
// output: 音频运行时策略
// pos: 共享业务库
export type AudioRuntimeProvider =
  | "qwen3voice"
  | "mixed";

export interface AudioSynthProbePolicy {
  text: string;
  requiresReferenceAudio: boolean;
  preferredMode?: string;
  voiceId?: string;
}

export interface AudioRuntimePolicy {
  provider: AudioRuntimeProvider;
  firstPassConcurrency: number;
  retryPassConcurrency: number;
  rescuePassConcurrency: number;
  cooldownMs: number;
  maxPasses: number;
  synthProbe: AudioSynthProbePolicy;
}

const AUDIO_RUNTIME_POLICIES: Record<AudioRuntimeProvider, AudioRuntimePolicy> = {
  qwen3voice: {
    provider: "qwen3voice",
    firstPassConcurrency: 3,
    retryPassConcurrency: 2,
    rescuePassConcurrency: 1,
    cooldownMs: 800,
    maxPasses: 3,
    synthProbe: {
      text: "系统探针。",
      requiresReferenceAudio: false,
      voiceId: "",
    },
  },
  mixed: {
    provider: "mixed",
    firstPassConcurrency: 2,
    retryPassConcurrency: 1,
    rescuePassConcurrency: 1,
    cooldownMs: 1000,
    maxPasses: 3,
    synthProbe: {
      text: "系统探针。",
      requiresReferenceAudio: false,
    },
  },
};

const normalizeProvider = (provider?: string | null): AudioRuntimeProvider => {
  const normalized =
    typeof provider === "string" ? provider.trim().toLowerCase() : "";

  if (normalized === "qwen3voice") {
    return "qwen3voice";
  }

  return "mixed";
};

export const getAudioRuntimePolicy = (
  provider?: string | null
): AudioRuntimePolicy => {
  const key = normalizeProvider(provider);
  return AUDIO_RUNTIME_POLICIES[key];
};
