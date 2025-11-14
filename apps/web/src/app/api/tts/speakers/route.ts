import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { indexTTSService } from "@/lib/indextts-service";
import { PrismaClient } from "@/generated/prisma";
import prisma from "@/lib/prisma";

// GET /api/tts/speakers - 获取说话人列表
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const gender = searchParams.get("gender");
  const ageGroup = searchParams.get("ageGroup");
  const isActive = searchParams.get("isActive");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search");

  const where: any = {};

  if (gender) {
    where.gender = gender;
  }

  if (ageGroup) {
    where.ageGroup = ageGroup;
  }

  if (isActive !== null) {
    where.isActive = isActive === "true";
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [speakers, total] = await Promise.all([
    prisma.speakerProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { isActive: "desc" },
        { usageCount: "desc" },
        { createdAt: "desc" },
      ],
    }),
    prisma.speakerProfile.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      speakers: speakers.map((speaker) => ({
        id: speaker.id,
        name: speaker.name,
        gender: speaker.gender,
        ageGroup: speaker.ageGroup,
        toneStyle: speaker.toneStyle,
        description: speaker.description,
        referenceAudio: speaker.referenceAudio,
        confidence: speaker.confidence
          ? parseFloat(speaker.confidence.toString())
          : null,
        metadata: speaker.metadata,
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
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const {
    name,
    gender = "unknown",
    ageGroup = "adult",
    toneStyle = "neutral",
    description,
    referenceAudio,
    metadata = {},
  } = body;

  const speaker = await prisma.speakerProfile.create({
    data: {
      name,
      gender,
      ageGroup,
      toneStyle,
      description,
      referenceAudio,
      metadata,
      isActive: true,
      usageCount: 0,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: speaker.id,
      name: speaker.name,
      gender: speaker.gender,
      ageGroup: speaker.ageGroup,
      toneStyle: speaker.toneStyle,
      description: speaker.description,
      referenceAudio: speaker.referenceAudio,
      confidence: speaker.confidence
        ? parseFloat(speaker.confidence.toString())
        : null,
      metadata: speaker.metadata,
      isActive: speaker.isActive,
      usageCount: speaker.usageCount,
      createdAt: speaker.createdAt,
      updatedAt: speaker.updatedAt,
    },
  });
});

