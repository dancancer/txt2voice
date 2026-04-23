CREATE TABLE IF NOT EXISTS "llm_model_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "baseURL" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKey" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_model_configs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_model_configs' AND column_name = 'base_url'
  ) THEN
    ALTER TABLE "llm_model_configs" RENAME COLUMN "base_url" TO "baseURL";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_model_configs' AND column_name = 'api_key'
  ) THEN
    ALTER TABLE "llm_model_configs" RENAME COLUMN "api_key" TO "apiKey";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_model_configs' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE "llm_model_configs" RENAME COLUMN "is_default" TO "isDefault";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_model_configs' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE "llm_model_configs" RENAME COLUMN "is_active" TO "isActive";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_model_configs' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE "llm_model_configs" RENAME COLUMN "sort_order" TO "sortOrder";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_model_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE "llm_model_configs" RENAME COLUMN "created_at" TO "createdAt";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_model_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "llm_model_configs" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "llm_model_configs_isDefault_idx"
  ON "llm_model_configs"("isDefault");
CREATE INDEX IF NOT EXISTS "llm_model_configs_isActive_sortOrder_createdAt_idx"
  ON "llm_model_configs"("isActive", "sortOrder", "createdAt");

CREATE TABLE IF NOT EXISTS "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "processingTaskId" TEXT,
    "status" TEXT NOT NULL,
    "entryPayload" JSONB,
    "runtimeConfig" JSONB,
    "summary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkflowRun_bookId_fkey"
      FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowRun_processingTaskId_fkey"
      FOREIGN KEY ("processingTaskId") REFERENCES "processing_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "StageRun" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StageRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StageRun_workflowRunId_fkey"
      FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AgentRun" (
    "id" TEXT NOT NULL,
    "stageRunId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "skillId" TEXT,
    "status" TEXT NOT NULL,
    "inputSummary" JSONB,
    "outputSummary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgentRun_stageRunId_fkey"
      FOREIGN KEY ("stageRunId") REFERENCES "StageRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ToolCall" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "argumentsSummary" JSONB,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ToolCall_agentRunId_fkey"
      FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TraceEvent" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "stageRunId" TEXT,
    "agentRunId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TraceEvent_workflowRunId_fkey"
      FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraceEvent_stageRunId_fkey"
      FOREIGN KEY ("stageRunId") REFERENCES "StageRun"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TraceEvent_agentRunId_fkey"
      FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RuntimeArtifact" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "stageRunId" TEXT,
    "agentRunId" TEXT,
    "segmentId" TEXT,
    "artifactKind" TEXT NOT NULL,
    "artifactVersion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuntimeArtifact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RuntimeArtifact_workflowRunId_fkey"
      FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuntimeArtifact_stageRunId_fkey"
      FOREIGN KEY ("stageRunId") REFERENCES "StageRun"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RuntimeArtifact_agentRunId_fkey"
      FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
