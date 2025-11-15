/**
 * 书籍相关API客户端工具函数
 */

import { PaginationParams, PaginationResult } from "./pagination";

export interface BookBasicInfo {
  id: string;
  title: string;
  author?: string;
  originalFilename?: string;
  fileSize?: bigint;
  totalWords?: number;
  totalCharacters?: number;
  totalSegments?: number;
  encoding?: string;
  fileFormat?: string;
  status: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    charactersCount: number;
    segmentsCount: number;
    scriptsCount: number;
    audioFilesCount: number;
  };
  processingTasks: any[];
  characterProfiles?: any[];
  textSegments?: any[];
  scriptSentences?: any[];
}

export interface CharacterProfile {
  id: string;
  canonicalName: string;
  characteristics: any;
  genderHint: string;
  ageHint?: number;
  emotionBaseline: string;
  isActive: boolean;
  mentions?: number;
  quotes?: number;
  aliases: Array<{
    id: string;
    alias: string;
    confidence: number;
  }>;
  voiceBindings: Array<{
    id: string;
    isDefault: boolean;
    customParameters?: any;
    emotionMappings: any;
    voiceProfile: {
      id: string;
      provider: string;
      voiceId: string;
      voiceName: string;
      displayName: string;
      isAvailable: boolean;
    };
  }>;
  speakerBindings: Array<{
    id: string;
    isDefault: boolean;
    metadata?: any;
    speakerProfile: {
      id: number;
      name?: string | null;
      gender: string;
      ageGroup: string;
      toneStyle: string;
      isActive: boolean;
    };
  }>;
  scriptSentencesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScriptSentence {
  id: string;
  text: string;
  rawSpeaker?: string;
  tone?: string;
  strength?: number;
  pauseAfter?: number;
  ttsParameters?: any;
  orderInSegment: number;
  character?: {
    id: string;
    canonicalName: string;
    genderHint: string;
    emotionBaseline: string;
  };
  segment?: {
    id: string;
    content: string;
    segmentIndex: number;
    orderIndex: number;
  };
  audioFiles: Array<{
    id: string;
    filePath: string;
    duration?: number;
    status: string;
    provider?: string;
    voiceProfile?: {
      id: string;
      voiceName: string;
      displayName: string;
    };
  }>;
  createdAt: Date;
}

export interface TextSegment {
  id: string;
  segmentIndex: number;
  startPosition: number;
  endPosition: number;
  content: string;
  wordCount?: number;
  segmentType?: string;
  orderIndex: number;
  metadata?: any;
  status: string;
  scriptSentences: Array<{
    id: string;
    text: string;
    characterId?: string;
    character?: {
      id: string;
      canonicalName: string;
      genderHint: string;
    };
  }>;
  audioFiles: Array<{
    id: string;
    filePath: string;
    duration?: number;
    status: string;
    provider?: string;
    voiceProfile?: {
      id: string;
      voiceName: string;
      displayName: string;
    };
  }>;
  scriptSentencesCount: number;
  audioFilesCount: number;
  createdAt: Date;
}

/**
 * 获取书籍基本信息
 */
export async function getBookBasicInfo(
  bookId: string,
  include?: string[]
): Promise<{ success: boolean; data: BookBasicInfo }> {
  const params = new URLSearchParams();
  if (include && include.length > 0) {
    params.set("include", include.join(","));
  }

  const response = await fetch(`/api/books/${bookId}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`获取书籍信息失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取书籍角色列表（分页）
 */
export async function getBookCharacters(
  bookId: string,
  params?: PaginationParams & {
    isActive?: boolean;
    search?: string;
  }
): Promise<{ success: boolean; data: PaginationResult<CharacterProfile> }> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  if (params?.isActive !== undefined)
    searchParams.set("isActive", params.isActive.toString());
  if (params?.search) searchParams.set("search", params.search);

  const response = await fetch(
    `/api/books/${bookId}/characters?${searchParams.toString()}`
  );
  if (!response.ok) {
    throw new Error(`获取角色列表失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取书籍台本列表（分页）
 */
export async function getBookScripts(
  bookId: string,
  params?: PaginationParams & {
    characterId?: string;
    segmentId?: string;
    search?: string;
    tone?: string;
  }
): Promise<{ success: boolean; data: PaginationResult<ScriptSentence> }> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  if (params?.characterId) searchParams.set("characterId", params.characterId);
  if (params?.segmentId) searchParams.set("segmentId", params.segmentId);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.tone) searchParams.set("tone", params.tone);

  const response = await fetch(
    `/api/books/${bookId}/scripts?${searchParams.toString()}`
  );
  if (!response.ok) {
    throw new Error(`获取台本列表失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取书籍分段列表（分页）
 */
export async function getBookSegments(
  bookId: string,
  params?: PaginationParams & {
    status?: string;
    segmentType?: string;
    search?: string;
    hasAudio?: boolean;
  }
): Promise<{ success: boolean; data: PaginationResult<TextSegment> }> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  if (params?.status) searchParams.set("status", params.status);
  if (params?.segmentType) searchParams.set("segmentType", params.segmentType);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.hasAudio !== undefined)
    searchParams.set("hasAudio", params.hasAudio.toString());

  const response = await fetch(
    `/api/books/${bookId}/segments?${searchParams.toString()}`
  );
  if (!response.ok) {
    throw new Error(`获取分段列表失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 创建新角色
 */
export async function createCharacter(
  bookId: string,
  characterData: {
    canonicalName: string;
    characteristics?: any;
    genderHint?: string;
    ageHint?: number;
    emotionBaseline?: string;
  }
): Promise<{ success: boolean; data: CharacterProfile }> {
  const response = await fetch(`/api/books/${bookId}/characters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(characterData),
  });

  if (!response.ok) {
    throw new Error(`创建角色失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 创建新台本句子
 */
export async function createScriptSentence(
  bookId: string,
  scriptData: {
    segmentId: string;
    characterId?: string;
    text: string;
    rawSpeaker?: string;
    tone?: string;
    strength?: number;
    pauseAfter?: number;
    ttsParameters?: any;
    orderInSegment?: number;
  }
): Promise<{ success: boolean; data: ScriptSentence }> {
  const response = await fetch(`/api/books/${bookId}/scripts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scriptData),
  });

  if (!response.ok) {
    throw new Error(`创建台本句子失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 创建新分段
 */
export async function createTextSegment(
  bookId: string,
  segmentData: {
    content: string;
    segmentIndex?: number;
    startPosition?: number;
    endPosition?: number;
    wordCount?: number;
    segmentType?: string;
    orderIndex?: number;
    metadata?: any;
  }
): Promise<{ success: boolean; data: TextSegment }> {
  const response = await fetch(`/api/books/${bookId}/segments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(segmentData),
  });

  if (!response.ok) {
    throw new Error(`创建分段失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 批量更新台本句子
 */
export async function updateScriptSentences(
  bookId: string,
  scripts: Partial<ScriptSentence>[]
): Promise<{ success: boolean; data: ScriptSentence[] }> {
  const response = await fetch(`/api/books/${bookId}/scripts`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scripts }),
  });

  if (!response.ok) {
    throw new Error(`更新台本句子失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 批量更新分段
 */
export async function updateTextSegments(
  bookId: string,
  segments: Partial<TextSegment>[]
): Promise<{ success: boolean; data: TextSegment[] }> {
  const response = await fetch(`/api/books/${bookId}/segments`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ segments }),
  });

  if (!response.ok) {
    throw new Error(`更新分段失败: ${response.statusText}`);
  }

  return response.json();
}
