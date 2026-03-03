// 一旦我被更新，请更新我的开头注释
// input: 播放页模型字段
// output: 播放页类型与格式化工具
// pos: 页面模型
export interface AudioFile {
  id: string;
  filename: string;
  duration: number;
  fileSize: number;
  createdAt: string;
  scriptSentence?: {
    text: string;
    orderInSegment: number;
  };
  character?: {
    canonicalName: string;
  };
}

export interface PlaybackBook {
  id: string;
  title: string;
  author?: string | null;
  audioFiles?: unknown[];
}

export const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatFileSize = (bytes: number) => {
  const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const mb = safeBytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};
