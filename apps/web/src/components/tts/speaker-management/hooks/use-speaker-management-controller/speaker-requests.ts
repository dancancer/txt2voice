// 一旦我被更新，请更新我的开头注释
// input: speaker CRUD 参数
// output: speaker 请求工具
// pos: TTS speaker management
import type { NewSpeakerForm, Speaker } from "../../types";

interface SpeakerListResult {
  speakers: Speaker[];
  totalPages: number;
}

export async function fetchSpeakersRequest(params: {
  page: number;
  searchTerm: string;
  filterGender: string;
  filterAgeGroup: string;
  filterActive: string;
}): Promise<SpeakerListResult> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: "20",
    ...(params.searchTerm && { search: params.searchTerm }),
    ...(params.filterGender && { gender: params.filterGender }),
    ...(params.filterAgeGroup && { ageGroup: params.filterAgeGroup }),
    ...(params.filterActive && { isActive: params.filterActive }),
  });

  const response = await fetch(`/api/tts/speakers?${searchParams}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "获取说话人列表失败");
  }

  return {
    speakers: data.data.speakers,
    totalPages: data.data.pagination.totalPages,
  };
}

export async function createSpeakerRequest(
  newSpeaker: NewSpeakerForm
): Promise<void> {
  const response = await fetch("/api/tts/speakers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newSpeaker),
  });
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "创建说话人失败");
  }
}

export async function updateSpeakerRequest(
  editingSpeaker: Speaker
): Promise<void> {
  const response = await fetch(`/api/tts/speakers/${editingSpeaker.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: editingSpeaker.name,
      gender: editingSpeaker.gender,
      ageGroup: editingSpeaker.ageGroup,
      toneStyle: editingSpeaker.toneStyle,
      description: editingSpeaker.description,
      referenceAudio: editingSpeaker.referenceAudio,
      isActive: editingSpeaker.isActive,
    }),
  });
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "更新说话人失败");
  }
}

export async function deleteSpeakerRequest(speakerId: string): Promise<void> {
  const response = await fetch(`/api/tts/speakers/${speakerId}`, {
    method: "DELETE",
  });
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "删除说话人失败");
  }
}
