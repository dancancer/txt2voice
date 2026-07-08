// 一旦我被更新，请更新我的开头注释
// input: OpenAI 凭证/TTS 请求
// output: OpenAI TTS provider 实现
// pos: TTS provider
import { TTSError } from "@/lib/error-handler";
import type { TTSRequest, TTSResponse, TTSVoice } from "@/lib/tts/types";

export class OpenAITTSService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    return [
      {
        id: "alloy",
        name: "alloy",
        displayName: "Alloy (中性)",
        language: "zh-CN",
        gender: "neutral",
        age: "adult",
        style: ["neutral"],
        description: "中性声音，适合旁白",
        isNeural: true,
      },
      {
        id: "echo",
        name: "echo",
        displayName: "Echo (男声)",
        language: "zh-CN",
        gender: "male",
        age: "adult",
        style: ["neutral"],
        description: "男性声音",
        isNeural: true,
      },
      {
        id: "fable",
        name: "fable",
        displayName: "Fable (英式男声)",
        language: "en-GB",
        gender: "male",
        age: "adult",
        style: ["narrative"],
        description: "英式男性声音，适合讲故事",
        isNeural: true,
      },
      {
        id: "onyx",
        name: "onyx",
        displayName: "Onyx (深沉男声)",
        language: "zh-CN",
        gender: "male",
        age: "adult",
        style: ["serious"],
        description: "深沉男性声音",
        isNeural: true,
      },
      {
        id: "nova",
        name: "nova",
        displayName: "Nova (女声)",
        language: "zh-CN",
        gender: "female",
        age: "adult",
        style: ["friendly"],
        description: "女性声音",
        isNeural: true,
      },
      {
        id: "shimmer",
        name: "shimmer",
        displayName: "Shimmer (温柔女声)",
        language: "zh-CN",
        gender: "female",
        age: "adult",
        style: ["gentle"],
        description: "温柔女性声音",
        isNeural: true,
      },
    ];
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: request.text,
          voice: request.voice.id,
          response_format: request.outputFormat,
          speed: request.speed || 1.0,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new TTSError(
          `OpenAI TTS synthesis failed: ${
            error.error?.message || response.statusText
          }`,
          "TTS_SERVICE_DOWN",
          "openai"
        );
      }

      const audioBuffer = await response.arrayBuffer();

      return {
        audioBuffer,
        duration: 0,
        format: request.outputFormat,
        sampleRate: 24000,
        metadata: {
          provider: "openai",
          voice: request.voice.id,
          model: "tts-1",
        },
      };
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      throw new TTSError(
        "OpenAI TTS service connection failed",
        "TTS_SERVICE_DOWN",
        "openai",
        true
      );
    }
  }
}
