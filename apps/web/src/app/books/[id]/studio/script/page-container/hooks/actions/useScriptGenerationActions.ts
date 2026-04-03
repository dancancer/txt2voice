// 一旦我被更新，请更新我的开头注释
// input: 生成流程依赖与上下文状态
// output: 台本/音频生成动作与进度状态
// pos: 页面容器 Hook
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SegmentStatus } from "../../../components";
import type { ConfirmDialogConfig } from "../useConfirmDialog";

interface LLMModelOption {
  id: string;
  label: string;
  provider: string;
  model: string;
  baseURL?: string;
}

type UseScriptGenerationActionsParams = {
  bookId: string;
  segments: Array<{ id: string }>;
  hasTextSegments: boolean;
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
  loadBookAndData: () => Promise<void>;
};

export function useScriptGenerationActions({
  bookId,
  segments,
  hasTextSegments,
  requestConfirmation,
  loadBookAndData,
}: UseScriptGenerationActionsParams) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");

  const [showIncrementalOptions, setShowIncrementalOptions] = useState(false);
  const [selectedStartSegment, setSelectedStartSegment] = useState<string | null>(null);
  const [segmentStatus, setSegmentStatus] = useState<SegmentStatus[]>([]);

  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentStatusLoading, setSegmentStatusLoading] = useState(false);
  const [llmModels, setLLMModels] = useState<LLMModelOption[]>([]);
  const [selectedLLMModelId, setSelectedLLMModelId] = useState("");
  const [llmModelsLoading, setLLMModelsLoading] = useState(false);
  const [llmModelsError, setLLMModelsError] = useState("");

  const progressStreamRef = useRef<EventSource | null>(null);

  const closeProgressStream = useCallback(() => {
    if (progressStreamRef.current) {
      progressStreamRef.current.close();
      progressStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeProgressStream();
    };
  }, [closeProgressStream]);

  const loadLLMModels = useCallback(async () => {
    try {
      setLLMModelsLoading(true);
      setLLMModelsError("");

      const response = await fetch("/api/llm/models");
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error?.message || "加载模型列表失败");
      }

      const models = Array.isArray(result.data?.models)
        ? (result.data.models as LLMModelOption[])
        : [];
      const defaultModelId =
        typeof result.data?.defaultModelId === "string"
          ? result.data.defaultModelId
          : "";

      setLLMModels(models);
      setSelectedLLMModelId((current) =>
        current && models.some((model) => model.id === current)
          ? current
          : defaultModelId
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "加载模型列表失败";
      setLLMModels([]);
      setSelectedLLMModelId("");
      setLLMModelsError(message);
      toast.error(message);
    } finally {
      setLLMModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLLMModels();
  }, [loadLLMModels]);

  const buildScriptGenerationOptions = useCallback(() => {
    if (!selectedLLMModelId) {
      throw new Error("LLM 模型尚未就绪，请先选择可用模型");
    }

    return {
      includeNarration: true,
      emotionDetection: true,
      contextAnalysis: true,
      minDialogueLength: 5,
      maxDialogueLength: 200,
      preserveOriginalBreaks: true,
      llmModelId: selectedLLMModelId,
    };
  }, [selectedLLMModelId]);

  const watchScriptGeneration = useCallback(
    (
      taskId: string,
      messages: { completed: string; failed: string },
      fallbackFailure: string
    ) => {
      closeProgressStream();
      setGenerationProgress(0);

      let finished = false;
      const stream = new EventSource(
        `/api/books/${bookId}/script/generate/stream?taskId=${encodeURIComponent(taskId)}`
      );
      progressStreamRef.current = stream;

      const timeoutId = window.setTimeout(() => {
        if (finished) {
          return;
        }

        setGenerationStatus("生成超时");
        setIsGenerating(false);
        closeProgressStream();
        finished = true;
        toast.error("生成超时，请稍后刷新页面确认任务状态");
      }, 5 * 60 * 1000);

      const finalize = (status: "completed" | "failed", errorMessage?: string) => {
        if (finished) {
          return;
        }

        finished = true;
        window.clearTimeout(timeoutId);
        closeProgressStream();

        if (status === "completed") {
          setGenerationStatus(messages.completed);
          setIsGenerating(false);
          toast.success(messages.completed);
          void loadBookAndData();
          return;
        }

        setGenerationStatus(messages.failed);
        setIsGenerating(false);
        toast.error(errorMessage || fallbackFailure);
      };

      stream.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (typeof data.progress === "number") {
            setGenerationProgress(data.progress);
          }
          if (typeof data.message === "string" && data.message.length > 0) {
            setGenerationStatus(data.message);
          }
          if (data.status === "completed") {
            finalize("completed");
          } else if (data.status === "failed") {
            const errorMessage =
              typeof data.error === "string" ? data.error : undefined;
            finalize("failed", errorMessage);
          }
        } catch (error) {
          console.error("Failed to parse script progress event:", error);
        }
      };

      stream.addEventListener("error", () => {
        if (finished) {
          return;
        }

        window.clearTimeout(timeoutId);
        setGenerationStatus("获取状态失败");
        setIsGenerating(false);
        closeProgressStream();
        finished = true;
        toast.error("获取任务状态失败，请刷新后查看最新结果");
      });
    },
    [bookId, closeProgressStream, loadBookAndData]
  );

  const generateScript = useCallback(async () => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus("开始生成台本...");

      if (!hasTextSegments) {
        toast.error("没有文本段落，请先处理文本");
        setIsGenerating(false);
        return;
      }

      if (segments.length === 0) {
        toast.error("没有可处理的文本段落");
        setIsGenerating(false);
        return;
      }

      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          options: buildScriptGenerationOptions(),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error?.message || "生成失败");
      }

      const taskId = result?.data?.taskId;
      if (!taskId) {
        throw new Error("未获取到任务ID");
      }

      setGenerationStatus("台本生成任务已启动！");
      watchScriptGeneration(
        taskId,
        { completed: "台本生成完成！", failed: "台本生成失败" },
        "台本生成失败，请检查配置后重试"
      );
    } catch (error) {
      console.error("Failed to generate script:", error);
      setGenerationStatus("台本生成失败");
      toast.error(
        `台本生成失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
      setIsGenerating(false);
    }
  }, [
    bookId,
    buildScriptGenerationOptions,
    hasTextSegments,
    segments.length,
    watchScriptGeneration,
  ]);

  const loadSegmentStatus = useCallback(async () => {
    try {
      setSegmentStatusLoading(true);
      const response = await fetch(
        `/api/books/${bookId}/script/generate?includeSegmentStatus=true`
      );
      if (!response.ok) {
        throw new Error("Failed to load segment status");
      }

      const result = await response.json();
      setSegmentStatus(result.data.segments.items || []);
    } catch (error) {
      console.error("Failed to load segment status:", error);
      toast.error("加载段落状态失败");
    } finally {
      setSegmentStatusLoading(false);
    }
  }, [bookId]);

  const handleIncrementalProcessing = useCallback(
    async (startSegmentId: string) => {
      try {
        setIsGenerating(true);
        setGenerationProgress(0);
        setGenerationStatus("开始增量生成台本...");

        const response = await fetch(`/api/books/${bookId}/script/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startFromSegmentId: startSegmentId,
            options: buildScriptGenerationOptions(),
          }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error?.message || "增量生成失败");
        }

        const taskId = result?.data?.taskId;
        if (!taskId) {
          throw new Error("未获取到任务ID");
        }

        setGenerationStatus("增量台本生成任务已启动！");
        setShowIncrementalOptions(false);

        watchScriptGeneration(
          taskId,
          { completed: "增量台本生成完成！", failed: "增量台本生成失败" },
          "增量台本生成失败，请检查配置后重试"
        );
      } catch (error) {
        console.error("Failed to start incremental processing:", error);
        setGenerationStatus("增量台本生成失败");
        toast.error(
          `增量台本生成失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        setIsGenerating(false);
      }
    },
    [bookId, buildScriptGenerationOptions, watchScriptGeneration]
  );

  const handleSegmentRegeneration = useCallback(
    async (segmentIds: string[], contextLabel?: string) => {
      try {
        setIsGenerating(true);
        setGenerationProgress(0);
        setGenerationStatus(
          contextLabel ? `${contextLabel}任务启动...` : "开始重新生成段落台本..."
        );

        const response = await fetch(`/api/books/${bookId}/script/generate`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            segmentIds,
            options: {
              llmModelId: selectedLLMModelId,
            },
          }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error?.message || "段落重新生成失败");
        }

        const taskId = result?.data?.taskId;
        if (!taskId) {
          throw new Error("未获取到任务ID");
        }

        setGenerationStatus(
          contextLabel ? `${contextLabel}任务已启动！` : "段落重新生成任务已启动！"
        );
        setShowRegenerateOptions(false);
        setSelectedSegments([]);

        watchScriptGeneration(
          taskId,
          {
            completed: contextLabel ? `${contextLabel}完成！` : "段落重新生成完成！",
            failed: contextLabel ? `${contextLabel}失败` : "段落重新生成失败",
          },
          "段落重新生成失败，请检查配置后重试"
        );
      } catch (error) {
        console.error("Failed to start segment regeneration:", error);
        setGenerationStatus(contextLabel ? `${contextLabel}失败` : "段落重新生成失败");
        toast.error(
          `段落重新生成失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        setIsGenerating(false);
      }
    },
    [bookId, selectedLLMModelId, watchScriptGeneration]
  );

  const regenerateScript = useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: "重新生成台本",
      description: "重新生成台本将覆盖现有内容，确定要继续吗？",
      confirmText: "继续生成",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    await generateScript();
  }, [generateScript, requestConfirmation]);

  return {
    isGenerating,
    generationProgress,
    generationStatus,
    showIncrementalOptions,
    setShowIncrementalOptions,
    llmModels,
    selectedLLMModelId,
    setSelectedLLMModelId,
    llmModelsLoading,
    llmModelsError,
    canGenerateScript: Boolean(selectedLLMModelId),
    selectedStartSegment,
    setSelectedStartSegment,
    segmentStatus,
    showRegenerateOptions,
    setShowRegenerateOptions,
    selectedSegments,
    setSelectedSegments,
    segmentStatusLoading,
    setSegmentStatus,
    generateScript,
    regenerateScript,
    loadSegmentStatus,
    handleIncrementalProcessing,
    handleSegmentRegeneration,
  };
}
