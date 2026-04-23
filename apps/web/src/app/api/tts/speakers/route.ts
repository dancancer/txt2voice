// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { ValidationError, withErrorHandler } from "@/lib/error-handler";
import { Qwen3VoiceTTSService } from "@/lib/tts/providers/qwen3voice";

// GET /api/tts/speakers - 获取说话人列表
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search");
  const service = new Qwen3VoiceTTSService();
  const speakers = await service.listSpeakers();

  const filteredSpeakers = speakers.filter((speaker) => {
    if (!search) {
      return true;
    }

    const normalizedSearch = search.trim().toLowerCase();
    return (
      speaker.name.toLowerCase().includes(normalizedSearch) ||
      (speaker.reference_text || "").toLowerCase().includes(normalizedSearch)
    );
  });

  const total = filteredSpeakers.length;
  const skip = (page - 1) * limit;
  const pagedSpeakers = filteredSpeakers.slice(skip, skip + limit);

  return NextResponse.json({
    success: true,
    data: {
      speakers: pagedSpeakers.map((speaker) => ({
        id: speaker.id,
        speakerId: speaker.id,
        name: speaker.name,
        gender: "unknown",
        ageGroup: "adult",
        toneStyle: "neutral",
        description: speaker.reference_text || "",
        referenceAudio: speaker.reference_audio_url || speaker.preview_audio_url || null,
        confidence: null,
        metadata: speaker.meta || {},
        isActive: true,
        usageCount: 0,
        lastUsedAt: null,
        syncedAt: speaker.created_at || null,
        createdAt: speaker.created_at || new Date().toISOString(),
        updatedAt: speaker.created_at || new Date().toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    },
  });
});

// POST /api/tts/speakers - 创建说话人档案
export const POST = withErrorHandler(async () => {
  throw new ValidationError("请改为在 qwen3-voice-studio 中创建和管理 speaker");
});
