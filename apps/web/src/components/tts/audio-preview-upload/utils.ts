import { normalizeDurationSeconds } from "@/lib/audio-utils";

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatDuration = (rawDuration?: number): string => {
  const seconds = normalizeDurationSeconds(rawDuration, 1000);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const getAudioTypeLabel = (type: string): string => {
  switch (type) {
    case "example":
      return "示例";
    case "uploaded":
      return "上传";
    case "emotion":
      return "情感";
    default:
      return type;
  }
};
