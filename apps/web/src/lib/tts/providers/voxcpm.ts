// 一旦我被更新，请更新我的开头注释
// input: VoxCPM2 服务地址/TTS 请求
// output: voxcpm provider 实现
// pos: TTS provider
import { createRemoteAudioResponse } from "@/lib/tts/remote-audio";
import type { TTSRequest, TTSResponse, TTSVoice } from "@/lib/tts/types";
import { VoxCPMService } from "@/lib/voxcpm-service";

const DEFAULT_VOICE_ID = "__voxcpm_default__";
const DEFAULT_BASE_URL = "http://192.168.88.9:18083";
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_VOICE: TTSVoice = {
  id: DEFAULT_VOICE_ID,
  name: "voxcpm2-default",
  displayName: "VoxCPM2 默认音色",
  language: "zh-CN",
  gender: "neutral",
  age: "adult",
  style: [
    "narration",
    "dialogue",
    "calm",
    "gentle",
    "serious",
    "cheerful",
    "sad",
    "angry",
  ],
  sampleRate: 48000,
  description: "VoxCPM2 instruction-controlled voice",
  isNeural: true,
  locale: "zh-CN",
};

const normalizeBaseUrl = (baseUrl?: string): string =>
  (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");

const describeShift = (
  value: number | undefined,
  low: string,
  high: string,
  neutral: number,
  threshold: number
): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= neutral - threshold) {
    return low;
  }

  if (value >= neutral + threshold) {
    return high;
  }

  return null;
};

const compact = (items: Array<string | null | undefined>): string[] =>
  items.filter((item): item is string => Boolean(item && item.trim()));

const resolveControlInstruction = (request: TTSRequest): string | undefined => {
  const voxcpmParams = request.providerParams?.voxcpm;
  if (voxcpmParams?.controlInstruction?.trim()) {
    return voxcpmParams.controlInstruction.trim();
  }

  const hints = compact([
    request.emotion ? `情绪偏 ${request.emotion}` : null,
    request.style ? `风格偏 ${request.style}` : null,
    describeShift(request.speed, "语速稍慢", "语速稍快", 1, 0.12),
    describeShift(request.pitch, "音高稍低", "音高稍高", 0, 3),
    describeShift(request.volume, "声音稍轻", "声音更有力", 1, 0.15),
  ]);

  return hints.length > 0
    ? `请用自然有声书口吻朗读，${hints.join("，")}。`
    : undefined;
};

export class VoxCPMTTSService {
  private service: VoxCPMService;

  constructor(baseUrl?: string, timeout = DEFAULT_TIMEOUT_MS) {
    this.service = new VoxCPMService({
      baseUrl: normalizeBaseUrl(baseUrl || process.env.VOXCPM_API_URL),
      timeout,
    });
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    await this.service.healthCheck();

    return [DEFAULT_VOICE];
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const voxcpmParams = request.providerParams?.voxcpm || {};
    const controlInstruction = resolveControlInstruction(request);
    const result = await this.service.synthesize({
      text: request.text,
      referenceAudio: request.referenceAudio,
      promptAudio: request.promptAudio,
      promptText: request.promptText,
      controlInstruction,
      cfgValue: voxcpmParams.cfgValue,
      inferenceTimesteps: voxcpmParams.inferenceTimesteps,
      normalize: voxcpmParams.normalize ?? true,
      denoise: voxcpmParams.denoise,
    });

    return createRemoteAudioResponse(
      result.audioUrl,
      {
        provider: "voxcpm",
        fallbackFormat: request.outputFormat,
        fallbackSampleRate: result.sampleRate || request.voice.sampleRate || 48000,
        duration: result.duration,
      },
      {
        voiceId: request.voice.id,
        controlInstruction,
        ...result.metadata,
      }
    );
  }
}
