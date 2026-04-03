import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import {
  deleteLLMModelConfig,
  ensureDefaultLLMModelConfig,
  updateLLMModelConfig,
  llmModelConfigUpdateSchema,
} from "@/lib/llm-model-config-service";

export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const body = await request.json();
  const parsed = llmModelConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "配置数据不合法");
  }

  const { id } = await params;
  const updated = await updateLLMModelConfig(id, parsed.data);

  return NextResponse.json({
    success: true,
    data: updated,
  });
});

export const DELETE = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  await deleteLLMModelConfig(id);

  return NextResponse.json({
    success: true,
  });
});

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "set-default") {
    throw new ValidationError("不支持的操作");
  }

  const { id } = await params;
  const updated = await ensureDefaultLLMModelConfig(id);

  return NextResponse.json({
    success: true,
    data: updated,
  });
});
