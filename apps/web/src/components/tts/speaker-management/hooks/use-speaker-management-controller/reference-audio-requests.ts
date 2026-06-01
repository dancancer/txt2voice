// 一旦我被更新，请更新我的开头注释
// input: 参考音频 provider/文件/选择集
// output: 参考音频请求与选择工具
// pos: TTS speaker management
import type { ReferenceAudio, TTSReferenceProvider } from "../../types";

export async function fetchReferenceAudiosRequest(
  provider: TTSReferenceProvider
): Promise<ReferenceAudio[]> {
  const allAudios: ReferenceAudio[] = [];
  const limit = 20;
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      provider,
    });

    const response = await fetch(`/api/tts/reference-audio?${params}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "获取参考音频列表失败");
    }

    allAudios.push(...data.data.audios);
    hasNext = data.data.pagination?.hasNext ?? false;
    page += 1;
  }

  return allAudios;
}

export async function deleteReferenceAudioRequest(params: {
  provider: TTSReferenceProvider;
  filename: string;
}): Promise<void> {
  const response = await fetch(
    `/api/tts/reference-audio?provider=${encodeURIComponent(
      params.provider
    )}&filename=${encodeURIComponent(params.filename)}`,
    {
      method: "DELETE",
    }
  );
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "音频删除失败");
  }
}

export async function uploadReferenceAudioRequest(params: {
  file: File;
  provider: TTSReferenceProvider;
  description?: string;
  onProgress: (progress: number) => void;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", params.file);
    if (params.description) {
      formData.append("description", params.description);
    }

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        params.onProgress((event.loaded / event.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status !== 200) {
        reject(new Error("音频上传失败"));
        return;
      }

      const data = JSON.parse(xhr.responseText);
      if (!data.success) {
        reject(new Error(data.error || "音频上传失败"));
        return;
      }

      resolve();
    });

    xhr.addEventListener("error", () => {
      reject(new Error("音频上传失败"));
    });

    xhr.open(
      "POST",
      `/api/tts/reference-audio?provider=${encodeURIComponent(params.provider)}`
    );
    xhr.send(formData);
  });
}

export function toggleSelectedAudioFilename(
  previous: string[],
  filename: string,
  checked: boolean
) {
  if (checked) {
    if (previous.includes(filename)) {
      return previous;
    }
    return [...previous, filename];
  }

  return previous.filter((item) => item !== filename);
}

export function setAudioSelectionState(
  previous: string[],
  filenames: string[],
  checked: boolean
) {
  const targets = filenames.filter(Boolean);
  if (targets.length === 0) {
    return previous;
  }

  if (checked) {
    const merged = new Set([...previous, ...targets]);
    return Array.from(merged);
  }

  const blocked = new Set(targets);
  return previous.filter((item) => !blocked.has(item));
}

export function retainAvailableAudioSelections(
  previous: string[],
  referenceAudios: ReferenceAudio[]
) {
  const available = new Set(
    referenceAudios
      .filter((audio) => audio.audioType !== "example")
      .map((audio) => audio.filename)
  );
  return previous.filter((filename) => available.has(filename));
}

export function removeDeletedAudioSelections(
  previous: string[],
  targets: string[]
) {
  return previous.filter((item) => !targets.includes(item));
}
