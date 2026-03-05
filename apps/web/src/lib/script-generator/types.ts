export interface DialogueLine {
  id: string;
  characterId?: string | null;
  characterName?: string;
  rawSpeaker?: string;
  text: string;
  orderInSegment: number;
  tone?: string;
  roleType?: "narration" | "dialogue" | "monologue" | "effect";
  emotionLabel?: string;
  emotionIntensity?: number;
  engineHint?: string;
  priority?: "high" | "normal" | "low";
  prosody?: {
    pace?: number;
    pitch?: number;
    energy?: number;
    pauseMsAfter?: number;
  };
  strength?: number;
  pauseAfter?: number;
  ttsParameters?: Record<string, any>;
  segmentId: string;
  chapterId?: string | null;
  isNarration?: boolean;
}

export interface CharacterCandidate {
  name: string;
  aliases: string[];
  description?: string;
  gender?: "male" | "female" | "unknown";
  age?: string | number | null;
  personality: string[];
  importance?: "main" | "secondary" | "minor";
  dialogueStyle?: string;
}

export interface ScriptGenerationOptions {
  includeNarration: boolean;
  emotionDetection: boolean;
  contextAnalysis: boolean;
  minDialogueLength: number;
  maxDialogueLength: number;
  preserveOriginalBreaks: boolean;
}

export interface ScriptGenerationSummary {
  totalLines: number;
  dialogueCount: number;
  narrationCount: number;
  totalSegments: number;
  processedSegments: number;
  failedSegments: number;
  failedSegmentIds: string[];
  characterDistribution: Record<string, number>;
  emotionDistribution: Record<string, number>;
}

export interface SegmentSummary {
  segmentId: string;
  lineCount: number;
  characters: string[];
}

export interface GeneratedScript {
  dialogueLines: DialogueLine[];
  summary: ScriptGenerationSummary;
  segments: SegmentSummary[];
}

export interface SegmentProcessingResult {
  dialogueLines: DialogueLine[];
  characterCandidates: CharacterCandidate[];
}
