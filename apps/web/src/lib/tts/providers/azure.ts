// 一旦我被更新，请更新我的开头注释
// input: Azure 凭证/TTS 请求
// output: Azure TTS provider 实现
// pos: TTS provider
import { TTSError } from "@/lib/error-handler";
import type { TTSRequest, TTSResponse, TTSVoice } from "@/lib/tts/types";

export class AzureTTSService {
  private apiKey: string;
  private region: string;

  constructor(apiKey: string, region: string) {
    this.apiKey = apiKey;
    this.region = region;
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Azure voices");
      }

      const voices = await response.json();

      return voices.map((voice: any) => ({
        id: voice.ShortName,
        name: voice.ShortName,
        displayName: voice.LocalName || voice.Name,
        language: voice.Locale,
        gender: voice.Gender.toLowerCase() as "male" | "female",
        age: "adult",
        style: voice.StyleList || [],
        sampleRate: voice.SampleRateHertz,
        description: voice.Description,
        isNeural: voice.VoiceType === "Neural",
        locale: voice.Locale,
      }));
    } catch (error) {
      console.error("Failed to fetch Azure voices:", error);
      return [];
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const ssml = this.generateSSML(request);

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": this.apiKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": this.getOutputFormat(
              request.outputFormat
            ),
          },
          body: ssml,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new TTSError(
          `Azure TTS synthesis failed: ${errorText}`,
          "TTS_SERVICE_DOWN",
          "azure"
        );
      }

      const audioBuffer = await response.arrayBuffer();

      return {
        audioBuffer,
        duration: 0,
        format: request.outputFormat,
        sampleRate: 24000,
        metadata: {
          provider: "azure",
          voice: request.voice.id,
          ssml,
        },
      };
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      throw new TTSError(
        "Azure TTS service connection failed",
        "TTS_SERVICE_DOWN",
        "azure",
        true
      );
    }
  }

  private generateSSML(request: TTSRequest): string {
    const {
      text,
      voice,
      speed = 1.0,
      pitch = 0,
      volume = 1.0,
      emotion,
      style,
    } = request;

    let prosody = "";
    if (speed !== 1.0) prosody += ` rate="${speed}"`;
    if (pitch !== 0) prosody += ` pitch="${pitch > 0 ? "+" : ""}${pitch}Hz"`;
    if (volume !== 1.0) prosody += ` volume="${volume}"`;

    let emotionExpression = "";
    if (emotion && voice.style.includes(emotion)) {
      emotionExpression = ` mstts:express-as="${emotion}"`;
    } else if (style && voice.style.includes(style)) {
      emotionExpression = ` mstts:express-as="${style}"`;
    }

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.language}">
      <voice name="${voice.id}">
        <prosody${prosody}>
          <p${emotionExpression}>
            ${text}
          </p>
        </prosody>
      </voice>
    </speak>`;
  }

  private getOutputFormat(format: string): string {
    const formats = {
      mp3: "audio-24khz-96kbitrate-mono-mp3",
      wav: "riff-24khz-16bit-mono-pcm",
      ogg: "ogg-24khz-16bit-mono-opus",
    };
    return formats[format as keyof typeof formats] || formats.mp3;
  }
}
