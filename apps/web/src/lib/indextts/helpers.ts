// 一旦我被更新，请更新我的开头注释
// input: 上传文件/env 限制
// output: IndexTTS 辅助函数
// pos: 共享业务库
export function validateIndexTtsAudioFile(
  file: File
): { valid: boolean; error?: string } {
  const allowedTypes = [
    "audio/wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/flac",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
  ];
  const allowedExtensions = [".wav", ".mp3", ".flac", ".m4a", ".ogg"];
  const maxSize = parseInt(process.env.INDEXTTS_MAX_FILE_SIZE || "104857600");
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

  if (!allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `不支持的文件格式: ${fileExtension}。支持的格式: ${allowedExtensions.join(", ")}`,
    };
  }

  if (file.type && !allowedTypes.includes(file.type)) {
    console.warn(
      `MIME type ${file.type} may not be recognized, but file extension ${fileExtension} is supported`
    );
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `文件大小超过限制: ${(file.size / 1024 / 1024).toFixed(2)}MB > ${(
        maxSize /
        1024 /
        1024
      ).toFixed(2)}MB`,
    };
  }

  return { valid: true };
}
