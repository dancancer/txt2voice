import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { getLLMModelRegistrySnapshot } from "@/lib/llm-model-registry";

export const GET = withErrorHandler(async (_request: NextRequest) => {
  const registry = getLLMModelRegistrySnapshot();

  return NextResponse.json({
    success: true,
    data: {
      defaultModelId: registry.defaultModelId,
      models: registry.models.map((model) => ({
        id: model.id,
        label: model.label,
        provider: model.provider,
        baseURL: model.baseURL,
        model: model.model,
      })),
    },
  });
});
