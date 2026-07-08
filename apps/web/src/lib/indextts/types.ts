// 一旦我被更新，请更新我的开头注释
// input: IndexTTS API 领域对象
// output: IndexTTS 共享类型
// pos: 共享业务库
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
}

export interface AudioAnalysis {
  filename: string;
  duration: number;
  sampleRate: number;
  fileSize: number;
  format: string;
  speakerId: string;
  confidence: number;
  embeddingShape: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface SpeakerComparison {
  audioFile1: string;
  audioFile2: string;
  cosineSimilarity: number;
  euclideanDistance: number;
  sameSpeakerProbability: number;
  isSameSpeaker: boolean;
}

export interface EmotionVector {
  happy: number;
  angry: number;
  sad: number;
  afraid: number;
  disgusted: number;
  melancholic: number;
  surprised: number;
  calm: number;
}

export interface SynthesizeRequest {
  text: string;
  referenceAudio: string;
  emoControlMethod:
    | "Same as the voice reference"
    | "Use separate emotion reference"
    | "Use emotion vectors";
  emotionReference?: string;
  emotionVector?: EmotionVector;
  emotionWeight?: number;
  sample?: number;
  temperature?: number;
  beamSearch?: boolean;
  topK?: number;
  topP?: number;
}

export interface SynthesizeResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  audioUrl?: string;
  duration?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface UploadResult {
  filename: string;
  originalName: string;
  url: string;
  fileSize: number;
  duration?: number;
  format: string;
}
