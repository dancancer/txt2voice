import type { ScriptGenerationOptions } from "./types";

export const DEFAULT_SCRIPT_GENERATION_OPTIONS: ScriptGenerationOptions = {
  includeNarration: true,
  emotionDetection: true,
  contextAnalysis: true,
  minDialogueLength: 5,
  maxDialogueLength: 200,
  preserveOriginalBreaks: true,
};

export function resolveScriptGenerationOptions(
  options: Partial<ScriptGenerationOptions> = {}
): ScriptGenerationOptions {
  return {
    ...DEFAULT_SCRIPT_GENERATION_OPTIONS,
    ...options,
  };
}
