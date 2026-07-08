import { TTSError } from "@/lib/error-handler";
import type { TTSRequest } from "@/lib/tts-service";

import type { AudioGenerationRequest, RouteAttemptContext } from "../types";
import { asRecord } from "../types";
import {
  clamp,
  normalizeNumber,
  normalizePitch,
  normalizeStrength,
  resolveStyleFromTone,
} from "./tts-parameter-normalizer";
import { planVoxCPMProsodyParams } from "./prosody-control-planner";

const asNonEmptyText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

export async function buildTTSRequest(params: {
  scriptSentence: any;
  voiceProfile: any;
  request: AudioGenerationRequest;
  routeAttemptContext?: RouteAttemptContext;
  ttsServiceManager: {
    ready: () => Promise<void>;
    getVoice: (provider: string, voiceId: string) => Promise<any>;
  };
}): Promise<TTSRequest> {
  const { scriptSentence, voiceProfile, request, routeAttemptContext, ttsServiceManager } =
    params;

  await ttsServiceManager.ready();
  const voice = await ttsServiceManager.getVoice(
    voiceProfile.provider,
    voiceProfile.voiceId
  );
  if (!voice) {
    throw new TTSError("声音配置无效", "TTS_SERVICE_DOWN", voiceProfile.provider);
  }

  const defaultParameters = asRecord(voiceProfile.defaultParameters) || {};
  const sentenceTtsParams = asRecord(scriptSentence.ttsParameters) || {};
  const ttsHints = asRecord(sentenceTtsParams.ttsHints) || {};

  const defaultSpeed = normalizeNumber(
    defaultParameters.rate ?? defaultParameters.speed,
    1
  );
  const defaultPitch = normalizePitch(defaultParameters.pitch);
  const defaultVolume = normalizeNumber(defaultParameters.volume, 1);
  const scriptStrength = normalizeStrength(
    scriptSentence.strength ?? sentenceTtsParams.strength
  );
  const strengthVolume =
    scriptStrength === null ? null : clamp(scriptStrength / 100, 0.2, 1.2);
  const tone =
    typeof scriptSentence.tone === "string" ? scriptSentence.tone.trim() : "";
  const routeEmotion = routeAttemptContext?.routeDecision.emotionLabel || undefined;
  const isVoxCPM = voiceProfile.provider === "voxcpm";
  const referenceAudio =
    asNonEmptyText(voiceProfile.referenceAudio) ||
    asNonEmptyText(defaultParameters.referenceAudio) ||
    asNonEmptyText(defaultParameters.reference_audio);
  const promptAudio =
    asNonEmptyText(voiceProfile.promptAudio) ||
    asNonEmptyText(defaultParameters.promptAudio) ||
    asNonEmptyText(defaultParameters.prompt_audio);
  const promptText =
    asNonEmptyText(voiceProfile.promptText) ||
    asNonEmptyText(defaultParameters.promptText) ||
    asNonEmptyText(defaultParameters.prompt_text);
  const voxcpmProsody = isVoxCPM
    ? planVoxCPMProsodyParams({
        tone,
        emotionLabel: scriptSentence.emotionLabel || routeEmotion,
        emotionIntensity: scriptSentence.emotionIntensity,
        prosody: scriptSentence.prosody,
        ttsParameters: scriptSentence.ttsParameters,
        requestOverrides: request.overrides,
        defaultParameters,
      })
    : null;

  return {
    text: scriptSentence.text,
    voice,
    outputFormat: request.outputFormat || "mp3",
    speed: clamp(
      normalizeNumber(
        request.overrides?.speed ??
          ttsHints.rate ??
          sentenceTtsParams.rate ??
          defaultSpeed,
        1
      ),
      0.5,
      2
    ),
    pitch: clamp(
      normalizePitch(
        request.overrides?.pitch ??
          ttsHints.pitch ??
          sentenceTtsParams.pitch ??
          defaultPitch
      ),
      -20,
      20
    ),
    volume: clamp(
      normalizeNumber(
        request.overrides?.volume ??
          sentenceTtsParams.volume ??
          strengthVolume ??
          defaultVolume,
        1
      ),
      0,
      1.5
    ),
    emotion: request.overrides?.emotion || routeEmotion || tone || undefined,
    style:
      request.overrides?.style ||
      resolveStyleFromTone(tone, voice.style) ||
      voice.style[0],
    ...(referenceAudio ? { referenceAudio } : {}),
    ...(promptAudio ? { promptAudio } : {}),
    ...(promptText ? { promptText } : {}),
    ...(voxcpmProsody ? { providerParams: { voxcpm: voxcpmProsody } } : {}),
  };
}
