// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/本地 speaker 数据
// output: VoxCPM2 本地说话人列表/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { ValidationError, withErrorHandler } from "@/lib/error-handler";
import prisma from "@/lib/prisma";

// GET /api/tts/speakers - 获取说话人列表
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search");
  const normalizedSearch = search?.trim();
  const where = {
    isActive: true,
    ...(normalizedSearch
      ? {
          OR: [
            { name: { contains: normalizedSearch, mode: "insensitive" as const } },
            {
              description: {
                contains: normalizedSearch,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const skip = (page - 1) * limit;
  const [total, speakers] = await Promise.all([
    prisma.speakerProfile.count({ where }),
    prisma.speakerProfile.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      speakers: speakers.map((speaker) => ({
        id: String(speaker.id),
        speakerId: String(speaker.id),
        name: speaker.name || `说话人 #${speaker.id}`,
        gender: speaker.gender,
        ageGroup: speaker.ageGroup,
        toneStyle: speaker.toneStyle,
        description: speaker.description || "",
        referenceAudio: speaker.referenceAudio || null,
        confidence: speaker.confidence ? Number(speaker.confidence) : null,
        metadata: speaker.metadata || {},
        isActive: speaker.isActive,
        usageCount: speaker.usageCount,
        lastUsedAt: speaker.lastUsedAt,
        syncedAt: speaker.syncedAt,
        createdAt: speaker.createdAt,
        updatedAt: speaker.updatedAt,
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
  throw new ValidationError("VoxCPM2 说话人由参考音频上传或自动角色路由创建");
});
