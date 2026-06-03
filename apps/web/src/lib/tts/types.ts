// 一旦我被更新，请更新我的开头注释
// input: TTS provider 配置/请求参数
// output: 共享类型定义
// pos: TTS 领域类型
import type { EmotionVector } from "@/lib/indextts-service";

export interface TTSProvider {
  name: string;
  type: "voxcpm" | "custom";
  apiKey?: string;
  region?: string;
  endpoint?: string;
  model?: string;
  isAvailable: boolean;
  supportedLanguages: string[];
  supportedVoices: TTSVoice[];
  maxCharacters: number;
  rateLimits?: {
    requestsPerMinute: number;
    charactersPerMinute: number;
  };
}

export interface TTSVoice {
  id: string;
  name: string;
  displayName: string;
  language: string;
  gender: "male" | "female" | "neutral";
  age: "child" | "teen" | "adult" | "senior";
  style: string[];
  sampleRate?: number;
  description?: string;
  isNeural?: boolean;
  locale?: string;
}

export interface TTSRequest {
  text: string;
  voice: TTSVoice;
  outputFormat: "mp3" | "wav" | "ogg";
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: string;
  style?: string;
  referenceAudio?: string;
  promptAudio?: string;
  promptText?: string;
  emoControlMethod?:
    | "Same as the voice reference"
    | "Use separate emotion reference"
    | "Use emotion vectors";
  emotionReference?: string;
  emotionVector?: EmotionVector;
  emotionWeight?: number;
  sample?: number;
  temperature?: number;
  beamSearch?: boolean;
  topK?: number;
  topP?: number;
  providerParams?: {
    voxcpm?: {
      controlInstruction?: string;
      cfgValue?: number;
      inferenceTimesteps?: number;
      normalize?: boolean;
      denoise?: boolean;
    };
  };
}

export interface TTSResponse {
  audioBuffer: ArrayBuffer;
  duration: number;
  format: string;
  sampleRate: number;
  metadata: Record<string, any>;
}
