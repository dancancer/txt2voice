import { normalizeDurationSeconds } from "@/lib/audio-utils";

export const AUDIO_PAGE_SIZE = 9;

export const DEFAULT_NEW_SPEAKER_FORM = {
  name: "",
  gender: "unknown",
  ageGroup: "adult",
  toneStyle: "neutral",
  description: "",
  referenceAudio: "",
};

export const translateGender = (gender: string): string => {
  const genderMap: Record<string, string> = {
    male: "男性",
    female: "女性",
    neutral: "中性",
    unknown: "未知",
  };

  return genderMap[gender] || gender;
};

export const translateAgeGroup = (ageGroup: string): string => {
  const ageGroupMap: Record<string, string> = {
    child: "儿童",
    teen: "青少年",
    adult: "成人",
    senior: "老年",
  };

  return ageGroupMap[ageGroup] || ageGroup;
};

export const translateToneStyle = (toneStyle: string): string => {
  const toneStyleMap: Record<string, string> = {
    neutral: "中性",
    gentle: "温柔",
    energetic: "活力",
    serious: "严肃",
    cheerful: "开朗",
  };

  return toneStyleMap[toneStyle] || toneStyle;
};

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
