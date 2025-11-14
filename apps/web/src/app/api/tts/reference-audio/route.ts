import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { indexTTSService, IndexTTSService } from "@/lib/indextts-service";
import prisma from "@/lib/prisma";

// GET /api/tts/reference-audio - 获取参考音频列表
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const audioType = searchParams.get("audioType") as
    | "example"
    | "uploaded"
    | "emotion"
    | undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search");

  try {
    const referenceAudios = await indexTTSService.getReferenceAudios();

    // 过滤音频
    let filteredAudios = referenceAudios;

    if (audioType) {
      filteredAudios = filteredAudios.filter(
        (audio) => audio.audioType === audioType
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredAudios = filteredAudios.filter(
        (audio) =>
          audio.originalName.toLowerCase().includes(searchLower) ||
          audio.filename.toLowerCase().includes(searchLower) ||
          (audio.description &&
            audio.description.toLowerCase().includes(searchLower))
      );
    }

    // 分页
    const total = filteredAudios.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedAudios = filteredAudios.slice(startIndex, endIndex);

    // 获取关联的说话人信息
    const speakerIds = [
      ...new Set(
        paginatedAudios.map((audio) => audio.speakerId).filter(Boolean)
      ),
    ];
    const speakers =
      speakerIds.length > 0
        ? await prisma.speakerProfile.findMany({
            where: {
              speakerId: { in: speakerIds as string[] },
            },
          })
        : [];

    const speakerMap = new Map(
      speakers.map((speaker) => [speaker.speakerId, speaker])
    );

    return NextResponse.json({
      success: true,
      data: {
        audios: paginatedAudios.map((audio) => ({
          filename: audio.filename,
          originalName: audio.originalName,
          filePath: audio.filePath,
          fileSize: audio.fileSize,
          duration: audio.duration,
          sampleRate: audio.sampleRate,
          format: audio.format,
          audioType: audio.audioType,
          description: audio.description,
          speakerId: audio.speakerId,
          url: audio.url,
          speaker: audio.speakerId ? speakerMap.get(audio.speakerId) : null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: endIndex < total,
          hasPrev: page > 1,
        },
        summary: {
          totalAudios: referenceAudios.length,
          exampleCount: referenceAudios.filter((a) => a.audioType === "example")
            .length,
          uploadedCount: referenceAudios.filter(
            (a) => a.audioType === "uploaded"
          ).length,
          emotionCount: referenceAudios.filter((a) => a.audioType === "emotion")
            .length,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch reference audios:", error);
    throw error;
  }
});

// POST /api/tts/reference-audio/upload - 上传参考音频
export const POST = withErrorHandler(async (request: NextRequest) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const description = formData.get("description") as string;

  if (!file) {
    return NextResponse.json(
      {
        success: false,
        error: "No file provided",
      },
      { status: 400 }
    );
  }

  // 验证文件格式
  const validation = IndexTTSService.validateAudioFile(file);
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: validation.error,
      },
      { status: 400 }
    );
  }

  try {
    // 上传到 IndexTTS
    const uploadResult = await indexTTSService.uploadAudio(file, description);

    // 暂时跳过音频分析，因为IndexTTS分析功能暂时有问题
    // TODO: 当IndexTTS分析功能修复后重新启用
    let analysis = null;
    let speaker = null;

    try {
      // 尝试分析音频获取说话人信息
      analysis = await indexTTSService.analyzeAudio(uploadResult.filename);

      // 创建或更新说话人档案
      speaker = await prisma.speakerProfile.findUnique({
        where: { speakerId: analysis.speakerId },
      });

      if (!speaker) {
        speaker = await prisma.speakerProfile.create({
          data: {
            speakerId: analysis.speakerId,
            name: uploadResult.originalName.replace(/\.[^/.]+$/, ""), // 移除文件扩展名
            gender: "unknown",
            ageGroup: "adult",
            toneStyle: "neutral",
            description: description || `从音频文件 ${uploadResult.originalName} 分析得到`,
            referenceAudio: uploadResult.filename,
            confidence: analysis.confidence,
            embeddingVector: Buffer.from(new Float32Array(analysis.embedding || [])),
            metadata: {
              originalFilename: uploadResult.originalName,
              uploadData: {
                filename: uploadResult.filename,
                originalName: uploadResult.originalName,
                url: uploadResult.url,
                fileSize: uploadResult.fileSize,
                format: uploadResult.format,
                duration: uploadResult.duration,
              } as any,
              analysis: analysis as any,
            },
            isActive: true,
            usageCount: 0,
            syncedAt: new Date(),
          },
        });
      }
    } catch (analysisError) {
      console.warn("Audio analysis failed, skipping speaker profile creation:", analysisError);
      // 分析失败时只返回上传结果，不创建说话人档案
    }

    return NextResponse.json({
      success: true,
      data: {
        upload: uploadResult,
        analysis,
        speaker: speaker ? {
          id: speaker.id,
          speakerId: speaker.speakerId,
          name: speaker.name,
          gender: speaker.gender,
          ageGroup: speaker.ageGroup,
          toneStyle: speaker.toneStyle,
          description: speaker.description,
          referenceAudio: speaker.referenceAudio,
          confidence: speaker.confidence ? parseFloat(speaker.confidence.toString()) : null,
          isActive: speaker.isActive,
          usageCount: speaker.usageCount,
          createdAt: speaker.createdAt,
          updatedAt: speaker.updatedAt,
        } : null,
        message: analysis ? "Audio uploaded and analyzed successfully" : "Audio uploaded successfully (analysis skipped)",
      },
    });
  } catch (error) {
    console.error("Failed to upload reference audio:", error);
    throw error;
  }
});

// DELETE /api/tts/reference-audio/[filename] - 删除参考音频
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const urlParts = request.url.split("/");
  const filename = urlParts[urlParts.length - 1];

  if (!filename) {
    return NextResponse.json(
      {
        success: false,
        error: "filename is required",
      },
      { status: 400 }
    );
  }

  try {
    // 从 IndexTTS 删除音频
    await indexTTSService.deleteAudio(filename);

    // 更新关联的说话人档案
    const affectedSpeakers = await prisma.speakerProfile.findMany({
      where: {
        OR: [
          { referenceAudio: filename },
          {
            metadata: {
              path: ["originalFilename"],
              string_contains: filename,
            },
          },
        ],
      },
    });

    for (const speaker of affectedSpeakers) {
      const currentMetadata = speaker.metadata as any;
      await prisma.speakerProfile.update({
        where: { id: speaker.id },
        data: {
          referenceAudio:
            speaker.referenceAudio === filename ? null : speaker.referenceAudio,
          metadata: {
            ...(typeof currentMetadata === "object" ? currentMetadata : {}),
            deletedFiles: [
              ...((currentMetadata as any)?.deletedFiles || []),
              { filename, deletedAt: new Date().toISOString() },
            ],
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        filename,
        deletedAt: new Date(),
        affectedSpeakers: affectedSpeakers.length,
      },
    });
  } catch (error) {
    console.error("Failed to delete reference audio:", error);
    throw error;
  }
});
