export interface ScriptSentence {
  id: string;
  text: string;
  orderInSegment: number;
  characterId?: string;
  segmentId: string;
  emotion?: string;
  character?: {
    id: string;
    name: string;
  };
  segment?: {
    id: string;
    content: string;
    orderIndex: number;
  };
}

export interface CharacterProfile {
  id: string;
  name: string;
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
