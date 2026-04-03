CREATE TABLE "llm_model_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "base_url" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "api_key" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_model_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_model_configs_is_default_idx" ON "llm_model_configs"("is_default");
CREATE INDEX "llm_model_configs_is_active_sort_order_created_at_idx" ON "llm_model_configs"("is_active", "sort_order", "created_at");
