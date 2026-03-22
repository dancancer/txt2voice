// 一旦我被更新，请更新我的开头注释
// input: 音频请求列表/阶段结果/provider 策略
// output: 分阶段重跑计划
// pos: 共享业务库
import { getAudioRuntimePolicy } from "./audio-runtime-policy";

export type AudioRetryPassName = "pass-1" | "pass-2" | "pass-3";

export type AudioRetryPassMode = "full" | "failed-only" | "rescue";

export interface AudioRetryPass<T> {
  passName: AudioRetryPassName;
  mode: AudioRetryPassMode;
  requests: T[];
  requestIds: string[];
  concurrency: number;
  cooldownMs: number;
}

interface BuildAudioRetryPassOptions<T> {
  provider?: string | null;
  passName: AudioRetryPassName;
  requests: T[];
  getRequestId: (request: T) => string;
}

interface BuildNextAudioRetryPassOptions<T> {
  provider?: string | null;
  previousPass: AudioRetryPass<T>;
  results: Array<{ success?: boolean } | null | undefined>;
  getRequestId: (request: T) => string;
}

const getPassMode = (passName: AudioRetryPassName): AudioRetryPassMode => {
  if (passName === "pass-1") {
    return "full";
  }
  if (passName === "pass-2") {
    return "failed-only";
  }
  return "rescue";
};

const getPassConcurrency = (
  provider: string | null | undefined,
  passName: AudioRetryPassName
): number => {
  const policy = getAudioRuntimePolicy(provider);

  if (passName === "pass-1") {
    return policy.firstPassConcurrency;
  }
  if (passName === "pass-2") {
    return policy.retryPassConcurrency;
  }
  return policy.rescuePassConcurrency;
};

const getNextPassName = (
  passName: AudioRetryPassName
): AudioRetryPassName | null => {
  if (passName === "pass-1") {
    return "pass-2";
  }
  if (passName === "pass-2") {
    return "pass-3";
  }
  return null;
};

const selectFailedRequests = <T>(
  requests: T[],
  results: Array<{ success?: boolean } | null | undefined>
): T[] =>
  requests.filter((request, index) => results[index]?.success !== true);

export const buildAudioRetryPass = <T>({
  provider,
  passName,
  requests,
  getRequestId,
}: BuildAudioRetryPassOptions<T>): AudioRetryPass<T> => ({
  passName,
  mode: getPassMode(passName),
  requests,
  requestIds: requests.map(getRequestId),
  concurrency: getPassConcurrency(provider, passName),
  cooldownMs: getAudioRuntimePolicy(provider).cooldownMs,
});

export const buildNextAudioRetryPass = <T>({
  provider,
  previousPass,
  results,
  getRequestId,
}: BuildNextAudioRetryPassOptions<T>): AudioRetryPass<T> | null => {
  const nextPassName = getNextPassName(previousPass.passName);
  if (!nextPassName) {
    return null;
  }

  const failedRequests = selectFailedRequests(previousPass.requests, results);
  if (failedRequests.length === 0) {
    return null;
  }

  return buildAudioRetryPass({
    provider,
    passName: nextPassName,
    requests: failedRequests,
    getRequestId,
  });
};
