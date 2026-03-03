export interface AudioFile {
  filename: string;
  originalName: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  format: string;
  audioType: "example" | "uploaded" | "emotion";
  description?: string;
  speakerId?: string;
  url: string;
  speaker?: any;
}

export interface AudioPreviewUploadProps {
  onUploadComplete?: (audio: AudioFile) => void;
  onDelete?: (filename: string) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
}
