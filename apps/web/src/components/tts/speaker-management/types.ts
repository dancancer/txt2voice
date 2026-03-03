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

export interface ReferenceAudio {
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  format: string;
  audioType: "example" | "uploaded" | "emotion";
  description?: string;
  speakerId?: string;
  url: string;
  speaker?: Speaker | null;
}

export interface NewSpeakerForm {
  name: string;
  gender: string;
  ageGroup: string;
  toneStyle: string;
  description: string;
  referenceAudio: string;
}

export interface UploadAudioPreview {
  originalName: string;
  fileSize: number;
  format: string;
}
