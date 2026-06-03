// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import prisma, { Prisma } from "@/lib/prisma";
import { z } from "zod";

const createBindingSchema = z.object({
  speakerId: z.string().min(1, "说话人ID无效").optional(),
  speakerProfileId: z
    .preprocess(
      (value) => (typeof value === "string" ? parseInt(value, 10) : value),
      z.number().int().positive("说话人ID无效")
    )
    .optional(),
  isPreferred: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).refine((value) => Boolean(value.speakerId || value.speakerProfileId), {
  message: "说话人ID无效",
});

const updateBindingSchema = z.object({
  bindingId: z.string().uuid("绑定ID无效"),
  isPreferred: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const toJsonValue = (value?: Record<string, unknown>): Prisma.InputJsonValue =>
  (value ?? {}) as Prisma.InputJsonValue;

const resolveSpeakerProfileId = (value: {
  speakerId?: string;
  speakerProfileId?: number;
}): number | null => {
  if (typeof value.speakerProfileId === "number") {
    return value.speakerProfileId;
  }

  const parsed = value.speakerId ? parseInt(value.speakerId, 10) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const serializeBinding = (binding: any) => ({
  id: binding.id,
  characterId: binding.characterId,
  speakerProfile: binding.speakerProfile,
  isPreferred: binding.isDefault,
  metadata: binding.metadata,
  createdAt: binding.createdAt,
  updatedAt: binding.updatedAt,
});

// GET /api/books/[id]/characters/[characterId]/speakers
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; characterId: string }> }
  ) => {
    const { id: bookId, characterId } = await params;

    const character = await prisma.characterProfile.findUnique({
      where: { id: characterId, bookId },
    });

    if (!character) {
      throw new ValidationError("角色不存在");
    }

    const bindings = await prisma.characterSpeakerBinding.findMany({
      where: { characterId },
      include: {
        speakerProfile: true,
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: {
        characterId,
        canonicalName: character.canonicalName,
        speakerBindings: bindings.map(serializeBinding),
        summary: {
          totalBindings: bindings.length,
          preferredBinding: bindings.find((b) => b.isDefault),
        },
      },
    });
  }
);

// POST /api/books/[id]/characters/[characterId]/speakers
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; characterId: string }> }
  ) => {
    const body = await request.json();
    const validatedData = createBindingSchema.parse(body);

    const { id: bookId, characterId } = await params;

    const character = await prisma.characterProfile.findUnique({
      where: { id: characterId, bookId },
    });

    if (!character) {
      throw new ValidationError("角色不存在");
    }

    const shouldBeDefault =
      validatedData.isPreferred !== undefined
        ? validatedData.isPreferred
        : (await prisma.characterSpeakerBinding.count({
            where: { characterId },
          })) === 0;

    const speakerProfileId = resolveSpeakerProfileId(validatedData);
    if (!speakerProfileId) {
      throw new ValidationError("说话人ID无效");
    }

    const speakerProfile = await prisma.speakerProfile.findUnique({
      where: { id: speakerProfileId },
    });

    if (!speakerProfile) {
      throw new ValidationError("说话人不存在");
    }

    if (!speakerProfile.isActive) {
      throw new ValidationError("该说话人未启用");
    }

    const existingBinding = await prisma.characterSpeakerBinding.findFirst({
      where: {
        characterId,
        speakerProfileId: speakerProfile.id,
      },
    });

    if (existingBinding) {
      throw new ValidationError("该角色已关联此说话人");
    }

    const bindingCount = await prisma.characterSpeakerBinding.count({
      where: { characterId },
    });

    if (shouldBeDefault && bindingCount > 0) {
      await prisma.characterSpeakerBinding.updateMany({
        where: { characterId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const binding = await prisma.characterSpeakerBinding.create({
      data: {
        characterId,
        speakerProfileId: speakerProfile.id,
        isDefault: shouldBeDefault,
        ...(validatedData.metadata && {
          metadata: toJsonValue(validatedData.metadata),
        }),
      },
      include: {
        speakerProfile: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBinding(binding),
    });
  }
);

// PATCH /api/books/[id]/characters/[characterId]/speakers
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; characterId: string }> }
  ) => {
    const body = await request.json();
    const validatedData = updateBindingSchema.parse(body);

    const { id: bookId, characterId } = await params;

    const character = await prisma.characterProfile.findUnique({
      where: { id: characterId, bookId },
    });

    if (!character) {
      throw new ValidationError("角色不存在");
    }

    const binding = await prisma.characterSpeakerBinding.findUnique({
      where: { id: validatedData.bindingId },
      include: {
        speakerProfile: true,
      },
    });

    if (!binding || binding.characterId !== characterId) {
      throw new ValidationError("声音绑定不存在");
    }

    const updateData: Prisma.CharacterSpeakerBindingUpdateInput = {
      updatedAt: new Date(),
    };

    if (validatedData.metadata !== undefined) {
      updateData.metadata = toJsonValue(validatedData.metadata);
    }

    if (validatedData.isPreferred !== undefined) {
      updateData.isDefault = validatedData.isPreferred;
      if (validatedData.isPreferred) {
        await prisma.characterSpeakerBinding.updateMany({
          where: {
            characterId,
            id: { not: validatedData.bindingId },
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }
    }

    const updatedBinding = await prisma.characterSpeakerBinding.update({
      where: { id: validatedData.bindingId },
      data: updateData,
      include: {
        speakerProfile: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBinding(updatedBinding),
    });
  }
);

// DELETE /api/books/[id]/characters/[characterId]/speakers
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; characterId: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const bindingId = searchParams.get("bindingId");

    if (!bindingId) {
      throw new ValidationError("绑定ID不能为空");
    }

    const { id: bookId, characterId } = await params;

    const character = await prisma.characterProfile.findUnique({
      where: { id: characterId, bookId },
    });

    if (!character) {
      throw new ValidationError("角色不存在");
    }

    const binding = await prisma.characterSpeakerBinding.findUnique({
      where: { id: bindingId },
      select: { id: true, characterId: true },
    });

    if (!binding || binding.characterId !== characterId) {
      throw new ValidationError("声音绑定不存在");
    }

    await prisma.characterSpeakerBinding.delete({
      where: { id: bindingId },
    });

    return NextResponse.json({
      success: true,
      message: "说话人已解除关联",
    });
  }
);
