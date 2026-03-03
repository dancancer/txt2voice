export interface AssignmentScriptSentence {
  id: string;
  text: string;
  orderInSegment: number;
  characterId?: string | null;
  character?: {
    id: string;
    canonicalName: string;
  } | null;
  segment?: {
    id: string;
    content: string;
    orderIndex: number;
  };
}

export interface AssignmentCharacter {
  id: string;
  canonicalName: string;
  isActive: boolean;
}

export interface CharacterAssignmentProps {
  scriptSentences: AssignmentScriptSentence[];
  characters: AssignmentCharacter[];
  showCharacterAssignment: boolean;
  onToggleAssignment: () => void;
  onSentenceCharacterChange: (sentenceId: string, characterId: string) => void;
  onSaveAssignment: () => void;
}

export interface Speaker {
  id: string;
  speakerId: string;
  name: string;
  gender: string;
  ageGroup: string;
  toneStyle: string;
  description: string;
  referenceAudio: string | null;
  confidence: number | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
