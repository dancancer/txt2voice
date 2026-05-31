// 一旦我被更新，请更新我的开头注释
// input: 台词/音频请求/路由选项/Prisma 客户端
// output: 默认声音路由决策
// pos: 自动编排声音路由 Agent
import type prisma from "@/lib/prisma";
import type {
  AudioGenerationOptions,
  AudioGenerationRequest,
  VoiceRouteResolution,
} from "@/lib/audio-generation/types";
import { resolveVoiceRouteForSentence } from "@/lib/audio-generation/routing/voice-route-resolver";

export interface VoiceRoutingAgentDecision {
  routeResolution: VoiceRouteResolution | null;
  manualReviewRequired: boolean;
  reason: string;
}

export const runVoiceRoutingAgent = async (params: {
  scriptSentence: any;
  request: AudioGenerationRequest;
  options: AudioGenerationOptions;
  prismaClient: typeof prisma;
}): Promise<VoiceRoutingAgentDecision> => {
  const routeResolution = await resolveVoiceRouteForSentence(params);

  if (routeResolution?.selectedCandidate) {
    return {
      routeResolution,
      manualReviewRequired: false,
      reason: routeResolution.selectedCandidate.source,
    };
  }

  return {
    routeResolution,
    manualReviewRequired: true,
    reason: "no_usable_voice_route",
  };
};
