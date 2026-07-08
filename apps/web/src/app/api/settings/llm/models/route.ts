import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ValidationError } from "@/lib/error-handler";
import {
  createLLMModelConfig,
  listPersistedLLMModelConfigs,
  llmModelConfigSchema,
} from "@/lib/llm-model-config-service";

export const GET = withErrorHandler(async (_request: NextRequest) => {
  const models = await listPersistedLLMModelConfigs();

  return NextResponse.json({
    success: true,
    data: {
      models,
    },
  });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = llmModelConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || "配置数据不合法");
  }

  const created = await createLLMModelConfig(parsed.data);

  return NextResponse.json({
    success: true,
    data: created,
  });
});
