import type { ScriptGenerationOptions } from "./types";

export const DEFAULT_SCRIPT_GENERATION_OPTIONS: ScriptGenerationOptions = {
  includeNarration: true,
  emotionDetection: true,
  contextAnalysis: true,
  minDialogueLength: 5,
  maxDialogueLength: 800,
  preserveOriginalBreaks: true,
};

export const resolveScriptGenerationOptions = (
  options: Partial<ScriptGenerationOptions> = {}
): ScriptGenerationOptions => ({
  ...DEFAULT_SCRIPT_GENERATION_OPTIONS,
  ...options,
});
