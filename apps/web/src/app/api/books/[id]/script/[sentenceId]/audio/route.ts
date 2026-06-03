// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { mkdir, stat, writeFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError, withErrorHandler } from "@/lib/error-handler";
import prisma, { Decimal } from "@/lib/prisma";
import { getBookAudioDir } from "@/lib/storage-path";
import { ttsServiceManager } from "@/lib/tts-service";

interface GenerateAudioBody {
  voiceBindingId?: string;
}

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sentenceId: string }> }
  ) => {
    const { id: bookId, sentenceId } = await params;
    let payload: GenerateAudioBody = {};

    if (request.headers.get("content-length")) {
      try {
        payload = await request.json();
      } catch (_error) {
        // 忽略空 body 或解析失败，走默认绑定
      }
    }

    const sentence = await prisma.scriptSentence.findUnique({
      where: { id: sentenceId },
      include: {
        character: {
          include: {
            voiceBindings: {
              include: { voiceProfile: true },
              orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            },
          },
        },
      },
    });

    if (!sentence || sentence.bookId !== bookId) {
      throw new ValidationError("台词不存在或不属于当前书籍");
    }

    if (!sentence.character) {
      throw new ValidationError("该台词尚未绑定角色，无法生成语音");
    }

    const voiceBindings = sentence.character.voiceBindings || [];
    if (voiceBindings.length === 0) {
      throw new ValidationError("该角色还没有关联音色，请先配置角色音色");
    }

    let binding = voiceBindings.find((item) => item.id === payload.voiceBindingId);
    if (!binding) {
      binding = voiceBindings.find((item) => item.isDefault) || voiceBindings[0];
    }

    const voiceProfile = binding.voiceProfile;
    if (!voiceProfile?.isAvailable) {
      throw new ValidationError("所选音色不可用，请重新绑定角色音色");
    }

    await ttsServiceManager.ready();
    const voice = await ttsServiceManager.getVoice(
      voiceProfile.provider,
      voiceProfile.voiceId
    );
    if (!voice) {
      throw new ValidationError("当前音色在 VoxCPM2 中不存在");
    }

    const synthesisResult = await ttsServiceManager.synthesize(
      {
        text: sentence.text,
        voice,
        outputFormat: "wav",
        temperature: 0.7,
        topK: 50,
        topP: 0.9,
      },
      voiceProfile.provider
    );

    const buffer = Buffer.from(synthesisResult.audioBuffer);
    const audioDir = getBookAudioDir(bookId);
    await mkdir(audioDir, { recursive: true });

    const extension = `.${synthesisResult.format || "wav"}`.replace(/\.+/, ".");
    const filename = `${sentence.id}-${Date.now()}${extension}`;
    const filePath = join(audioDir, filename);
    await writeFile(filePath, buffer);
    const fileStats = await stat(filePath);

    const audioFile = await prisma.audioFile.create({
      data: {
        bookId,
        sentenceId: sentence.id,
        segmentId: sentence.segmentId,
        fileName: filename,
        filePath,
        format: (synthesisResult.format || "wav") as "mp3" | "wav" | "ogg",
        fileSize: BigInt(fileStats.size),
        duration:
          typeof synthesisResult.duration === "number"
            ? new Decimal(synthesisResult.duration.toFixed(2))
            : null,
        status: "completed",
        provider: voiceProfile.provider,
        voiceProfileId: voiceProfile.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        audioFileId: audioFile.id,
        playbackUrl: `/api/audio/${audioFile.id}`,
        provider: voiceProfile.provider,
        duration: audioFile.duration,
        fileSize: Number(fileStats.size),
      },
    });
  }
);
