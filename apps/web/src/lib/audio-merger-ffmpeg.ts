// 一旦我被更新，请更新我的开头注释
// input: ffmpeg 合并参数
// output: ffmpeg 音频合并执行体
// pos: 共享业务库
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";

import { execAsync, type AudioMergeOptions, type AudioMergeResult } from "./audio-merger-helpers";
import { getBookMergedAudioDir, getUploadTempDir } from "./storage-path";

export async function mergeAudioFilesWithFFmpeg(params: {
  bookId: string;
  chapterId: string | null;
  title: string;
  audioPaths: string[];
  options: AudioMergeOptions;
}): Promise<AudioMergeResult> {
  const timestamp = Date.now();
  const tempDir = getUploadTempDir();
  const outputDir = getBookMergedAudioDir(params.bookId);

  try {
    await mkdir(tempDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const listFilePath = join(tempDir, `filelist_${timestamp}.txt`);
    const fileListContent = params.audioPaths
      .map((audioPath) => `file '${audioPath.replace(/'/g, "'\\''")}'`)
      .join("\n");

    await writeFile(listFilePath, fileListContent, "utf-8");

    const sanitizedTitle = params.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_");
    const chapterSuffix = params.chapterId ? `_chapter_${timestamp}` : `_full_${timestamp}`;
    const fileName = `${sanitizedTitle}${chapterSuffix}.${params.options.format}`;
    const outputPath = join(outputDir, fileName);

    let ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${listFilePath}"`;
    ffmpegCommand += " -c copy";

    if (params.options.bitrate && params.options.format === "mp3") {
      ffmpegCommand = ffmpegCommand.replace(
        "-c copy",
        `-c:a libmp3lame -b:a ${params.options.bitrate}`
      );
    }

    ffmpegCommand += ` "${outputPath}"`;

    console.log(`执行 ffmpeg 命令: ${ffmpegCommand}`);
    const { stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 10,
    });

    if (stderr) {
      console.log("FFmpeg stderr:", stderr);
    }

    try {
      await unlink(listFilePath);
    } catch (error) {
      console.warn("清理临时文件失败:", error);
    }

    const stats = await import("fs").then((fs) => fs.statSync(outputPath));
    const totalDuration = params.audioPaths.length * 5;

    return {
      success: true,
      outputPath,
      fileName,
      fileSize: stats.size,
      duration: totalDuration,
      metadata: {
        audioFileCount: params.audioPaths.length,
        totalDuration,
        format: params.options.format || "mp3",
      },
    };
  } catch (error) {
    console.error("FFmpeg 合并失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "FFmpeg execution failed",
    };
  }
}
