import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { ttsServiceManager } from "@/lib/tts-service";

// GET /api/tts/providers - 获取可用的 TTS 提供商
export const GET = withErrorHandler(async () => {
  try {
    await ttsServiceManager.ready();
    const providers = ttsServiceManager.getAvailableProviders();

    return NextResponse.json({
      success: true,
      data: {
        providers: providers.map((provider) => ({
          name: provider.name,
          type: provider.type,
          isAvailable: provider.isAvailable,
          supportedLanguages: provider.supportedLanguages,
          supportedVoices: provider.supportedVoices.map((voice) => ({
            id: voice.id,
            name: voice.name,
            displayName: voice.displayName,
            language: voice.language,
            gender: voice.gender,
            age: voice.age,
            style: voice.style,
            description: voice.description,
            isNeural: voice.isNeural,
          })),
          maxCharacters: provider.maxCharacters,
          rateLimits: provider.rateLimits,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to get TTS providers:", error);
    throw error;
  }
});
