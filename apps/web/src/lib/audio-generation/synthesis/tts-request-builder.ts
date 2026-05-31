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
  const controlInstruction =
    request.overrides?.controlInstruction ||
    (typeof ttsHints.controlInstruction === "string"
      ? ttsHints.controlInstruction
      : undefined) ||
    (typeof sentenceTtsParams.controlInstruction === "string"
      ? sentenceTtsParams.controlInstruction
      : undefined) ||
    (typeof defaultParameters.controlInstruction === "string"
      ? defaultParameters.controlInstruction
      : undefined);
  const cfgValue = normalizeNumber(
    request.overrides?.cfgValue ??
      ttsHints.cfgValue ??
      ttsHints.cfg_value ??
      sentenceTtsParams.cfgValue ??
      sentenceTtsParams.cfg_value ??
      defaultParameters.cfgValue ??
      defaultParameters.cfg_value,
    Number.NaN
  );
  const inferenceTimesteps = normalizeNumber(
    request.overrides?.inferenceTimesteps ??
      ttsHints.inferenceTimesteps ??
      ttsHints.inference_timesteps ??
      sentenceTtsParams.inferenceTimesteps ??
      sentenceTtsParams.inference_timesteps ??
      defaultParameters.inferenceTimesteps ??
      defaultParameters.inference_timesteps,
    Number.NaN
  );

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
    controlInstruction,
    ...(Number.isFinite(cfgValue) ? { cfgValue } : {}),
    ...(Number.isFinite(inferenceTimesteps) ? { inferenceTimesteps } : {}),
    ...(typeof request.overrides?.normalize === "boolean"
      ? { normalize: request.overrides.normalize }
      : {}),
    ...(typeof request.overrides?.denoise === "boolean"
      ? { denoise: request.overrides.denoise }
      : {}),
  };
}
