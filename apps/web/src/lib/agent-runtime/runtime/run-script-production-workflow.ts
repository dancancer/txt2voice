import { getScriptGenerator } from "@/lib/script-generator";
import type { ScriptGenerationOptions } from "@/lib/script-generator";
import type { GeneratedScript } from "@/lib/script-generator/types";
import type { LLMExecutionEvent } from "@/lib/llm-service";

export type ScriptProductionWorkflowMode = "full" | "partial" | "regenerate";

export interface RunScriptProductionWorkflowInput {
  bookId: string;
  options: Partial<ScriptGenerationOptions>;
  mode: ScriptProductionWorkflowMode;
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  limitToSegments?: number;
  segmentIds?: string[];
  onProgress?: (done: number, total: number) => Promise<void> | void;
  onExecutionEvent?: (event: LLMExecutionEvent) => void;
}

const setExecutionObserver = (
  scriptGenerator: ReturnType<typeof getScriptGenerator>,
  observer: ((event: LLMExecutionEvent) => void) | null
) => {
  if (typeof scriptGenerator.setExecutionObserver !== "function") {
    return;
  }

  scriptGenerator.setExecutionObserver(observer);
};

export const runScriptProductionWorkflow = async (
  input: RunScriptProductionWorkflowInput
): Promise<GeneratedScript> => {
  const scriptGenerator = getScriptGenerator();
  setExecutionObserver(scriptGenerator, input.onExecutionEvent ?? null);

  try {
    if (input.mode === "regenerate") {
      return scriptGenerator.regenerateSegmentScript(
        input.bookId,
        input.segmentIds || [],
        input.options,
        input.onProgress
      );
    }

    if (input.mode === "partial") {
      return scriptGenerator.generatePartialScript(
        input.bookId,
        input.options,
        {
          startFromSegmentId: input.startFromSegmentId,
          startFromOrderIndex: input.startFromOrderIndex,
          limitToSegments: input.limitToSegments,
        },
        input.onProgress
      );
    }

    return scriptGenerator.generateScript(
      input.bookId,
      input.options,
      input.onProgress
    );
  } finally {
    setExecutionObserver(scriptGenerator, null);
  }
};
