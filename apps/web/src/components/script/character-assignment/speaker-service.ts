import type { Speaker } from "./types";

interface SpeakerListResponse {
  success?: boolean;
  data?: {
    speakers?: Speaker[];
  };
}

interface SynthesisResponse {
  success?: boolean;
  error?: string;
  data?: {
    audioUrl?: string;
  };
}

export async function fetchSpeakers(): Promise<Speaker[]> {
  const response = await fetch("/api/tts/speakers?limit=50");
  const data = (await response.json()) as SpeakerListResponse;

  if (!response.ok || !data.success) {
    throw new Error("获取说话人列表失败");
  }

  return data.data?.speakers || [];
}

export async function requestSynthesisPreview(
  speaker: Speaker,
  text: string
): Promise<string | undefined> {
  const response = await fetch("/api/tts/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      provider: "voxcpm",
      voiceId: "__voxcpm_default__",
      speakerId: speaker.speakerId || speaker.id,
      referenceAudio: speaker.referenceAudio || undefined,
      outputFormat: "mp3",
    }),
  });

  const data = (await response.json()) as SynthesisResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error || "语音合成测试失败");
  }

  return data.data?.audioUrl;
}
