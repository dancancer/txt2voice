export interface ScriptSentence {
  id: string;
  text: string;
  orderInSegment: number;
  characterId?: string | null; // 当是旁白时为 null
  segmentId: string;
  tone?: string;
  rawSpeaker?: string; // 原始说话人信息
  strength?: number;
  pauseAfter?: number;
  character?: {
    id: string;
    canonicalName: string;
  } | null; // 当是旁白时为 null
  segment?: {
    id: string;
    content: string;
    orderIndex: number;
  };
  audioFiles?: Array<{
    id: string;
    status: string;
    duration?: number | string | null;
  }>;
}

export interface CharacterProfile {
  id: string;
  canonicalName: string;
  description?: string;
  isActive: boolean;
  aliases: Array<{ alias: string }>;
}

export interface SegmentStatus {
  id: string;
  content: string;
  orderIndex: number;
  wordCount: number;
  lineCount?: number;
  processed: boolean;
}

export type ScriptNavigationNode =
  | { type: "book"; id: string }
  | { type: "chapter"; id: string }
  | { type: "segment"; id: string };

export interface ChapterTreeNode {
  id: string;
  title: string;
  chapterIndex?: number;
  status?: string;
  totalSegments: number;
  scriptSegments: number;
  audioSegments: number;
  isVirtual?: boolean;
  segments: Array<{
    id: string;
    label: string;
    hasScript: boolean;
    hasAudio: boolean;
    preview: string;
  }>;
}
