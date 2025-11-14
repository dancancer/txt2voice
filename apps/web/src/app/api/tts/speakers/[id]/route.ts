import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import prisma from "@/lib/prisma";

// PUT /api/tts/speakers/[id] - 更新说话人档案
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      {
        success: false,
        error: "Speaker ID is required",
      },
      { status: 400 }
    );
  }

  const body = await request.json();
  const {
    name,
    gender,
    ageGroup,
    toneStyle,
    description,
    referenceAudio,
    isActive,
  } = body;

  // 检查说话人是否存在
  const existingSpeaker = await prisma.speakerProfile.findUnique({
    where: { id: parseInt(id) },
  });

  if (!existingSpeaker) {
    return NextResponse.json(
      {
        success: false,
        error: "Speaker not found",
      },
      { status: 404 }
    );
  }

  const speaker = await prisma.speakerProfile.update({
    where: { id: parseInt(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(gender !== undefined && { gender }),
      ...(ageGroup !== undefined && { ageGroup }),
      ...(toneStyle !== undefined && { toneStyle }),
      ...(description !== undefined && { description }),
      ...(referenceAudio !== undefined && { referenceAudio }),
      ...(isActive !== undefined && { isActive }),
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
      lastUsedAt: speaker.lastUsedAt,
      syncedAt: speaker.syncedAt,
      createdAt: speaker.createdAt,
      updatedAt: speaker.updatedAt,
    },
  });
});

// DELETE /api/tts/speakers/[id] - 删除说话人档案
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      {
        success: false,
        error: "Speaker ID is required",
      },
      { status: 400 }
    );
  }

  // 检查说话人是否存在
  const existingSpeaker = await prisma.speakerProfile.findUnique({
    where: { id: parseInt(id) },
  });

  if (!existingSpeaker) {
    return NextResponse.json(
      {
        success: false,
        error: "Speaker not found",
      },
      { status: 404 }
    );
  }

  await prisma.speakerProfile.delete({
    where: { id: parseInt(id) },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: parseInt(id),
      deletedAt: new Date(),
      message: "Speaker deleted successfully",
    },
  });
});