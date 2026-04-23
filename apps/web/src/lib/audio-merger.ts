// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import prisma from './prisma'
import {
  AudioMergeOptions,
  AudioMergeResult,
  checkFFmpegAvailable,
  defaultAudioMergeOptions,
  resolveReadableAudioPath,
} from './audio-merger-helpers'
import { mergeAudioFilesWithFFmpeg } from './audio-merger-ffmpeg'
import { getBookMergedAudioDir } from './storage-path'

/**
 * 音频合并工具类
 */
export class AudioMerger {
  private readonly defaultOptions: AudioMergeOptions = defaultAudioMergeOptions

  /**
   * 合并章节的所有音频文件
   */
  async mergeChapterAudio(
    bookId: string,
    chapterId: string,
    options: AudioMergeOptions = {}
  ): Promise<AudioMergeResult> {
    const finalOptions = { ...this.defaultOptions, ...options }

    try {
      // 检查 ffmpeg
      const ffmpegAvailable = await checkFFmpegAvailable()
      if (!ffmpegAvailable) {
        return {
          success: false,
          error: 'FFmpeg 不可用，无法合并音频。请确保 ffmpeg 已安装。'
        }
      }

      // 获取章节信息
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: {
          book: true
        }
      })

      if (!chapter) {
        return {
          success: false,
          error: '章节不存在'
        }
      }

      // 获取该章节的所有音频文件（按顺序）
      const audioFiles = await prisma.audioFile.findMany({
        where: {
          chapterId,
          status: 'completed'
        },
        include: {
          scriptSentence: {
            select: {
              id: true,
              orderInSegment: true,
              segment: {
                select: {
                  chapterOrderIndex: true
                }
              }
            }
          }
        },
        orderBy: [
          { scriptSentence: { segment: { chapterOrderIndex: 'asc' } } },
          { scriptSentence: { orderInSegment: 'asc' } }
        ]
      })

      if (audioFiles.length === 0) {
        return {
          success: false,
          error: '该章节没有可合并的音频文件'
        }
      }

      const resolvedAudioFiles = audioFiles.map((audioFile) => ({
        ...audioFile,
        resolvedPath: resolveReadableAudioPath(audioFile)
      }))

      // 验证所有音频文件是否存在
      const missingFiles = resolvedAudioFiles.filter(af => !af.resolvedPath)
      if (missingFiles.length > 0) {
        console.warn(`发现 ${missingFiles.length} 个缺失的音频文件`)
      }

      const validAudioFiles = resolvedAudioFiles.filter(
        (audioFile): audioFile is typeof audioFile & { resolvedPath: string } =>
          Boolean(audioFile.resolvedPath)
      )
      if (validAudioFiles.length === 0) {
        return {
          success: false,
          error: '所有音频文件都不存在'
        }
      }

      // 使用 ffmpeg 合并音频
      const result = await mergeAudioFilesWithFFmpeg({
        bookId,
        chapterId,
        title: chapter.title,
        audioPaths: validAudioFiles.map(af => af.resolvedPath),
        options: finalOptions
      })

      if (result.success && result.outputPath) {
        // 创建合并后的音频记录
        const stats = await import('fs').then(fs => fs.statSync(result.outputPath!))
        await prisma.audioFile.create({
          data: {
            bookId,
            chapterId,
            filePath: result.outputPath,
            fileName: result.fileName!,
            fileSize: BigInt(stats.size),
            duration: result.duration ?? null,
            format: finalOptions.format,
            status: 'completed',
            provider: 'merged'
          }
        })
      }

      return result

    } catch (error) {
      console.error('合并章节音频失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 合并整本书的音频
   */
  async mergeBookAudio(
    bookId: string,
    options: AudioMergeOptions = {}
  ): Promise<AudioMergeResult> {
    const finalOptions = { ...this.defaultOptions, ...options }

    try {
      // 检查 ffmpeg
      const ffmpegAvailable = await checkFFmpegAvailable()
      if (!ffmpegAvailable) {
        return {
          success: false,
          error: 'FFmpeg 不可用，无法合并音频'
        }
      }

      // 获取书籍信息
      const book = await prisma.book.findUnique({
        where: { id: bookId }
      })

      if (!book) {
        return {
          success: false,
          error: '书籍不存在'
        }
      }

      // 获取该书的所有音频文件（按章节和段落顺序）
      const audioFiles = await prisma.audioFile.findMany({
        where: {
          bookId,
          status: 'completed',
          sentenceId: { not: null }
        },
        include: {
          chapter: {
            select: {
              chapterIndex: true
            }
          },
          scriptSentence: {
            select: {
              orderInSegment: true,
              segment: {
                select: {
                  chapterOrderIndex: true
                }
              }
            }
          }
        },
        orderBy: [
          { chapter: { chapterIndex: 'asc' } },
          { scriptSentence: { segment: { chapterOrderIndex: 'asc' } } },
          { scriptSentence: { orderInSegment: 'asc' } }
        ]
      })

      if (audioFiles.length === 0) {
        return {
          success: false,
          error: '该书籍没有可合并的音频文件'
        }
      }

      const validAudioFiles = audioFiles
        .map((audioFile) => ({
          ...audioFile,
          resolvedPath: resolveReadableAudioPath(audioFile)
        }))
        .filter((audioFile): audioFile is typeof audioFile & { resolvedPath: string } =>
          Boolean(audioFile.resolvedPath)
        )
      if (validAudioFiles.length === 0) {
        return {
          success: false,
          error: '所有音频文件都不存在'
        }
      }

      // 使用 ffmpeg 合并音频
      const result = await mergeAudioFilesWithFFmpeg({
        bookId,
        chapterId: null,
        title: book.title,
        audioPaths: validAudioFiles.map(af => af.resolvedPath),
        options: finalOptions
      })

      if (result.success && result.outputPath) {
        // 创建合并后的音频记录
        const stats = await import('fs').then(fs => fs.statSync(result.outputPath!))
        await prisma.audioFile.create({
          data: {
            bookId,
            filePath: result.outputPath,
            fileName: result.fileName!,
            fileSize: BigInt(stats.size),
            duration: result.duration ?? null,
            format: finalOptions.format,
            status: 'completed',
            provider: 'merged'
          }
        })
      }

      return result

    } catch (error) {
      console.error('合并书籍音频失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 为段落生成合并音频
   */
  async mergeSegmentAudio(
    segmentId: string,
    options: AudioMergeOptions = {}
  ): Promise<AudioMergeResult> {
    const finalOptions = { ...this.defaultOptions, ...options }

    try {
      // 获取段落的所有音频文件
      const audioFiles = await prisma.audioFile.findMany({
        where: {
          segmentId,
          status: 'completed'
        },
        include: {
          scriptSentence: {
            select: {
              orderInSegment: true
            }
          },
          segment: {
            select: {
              bookId: true,
              chapterId: true
            }
          }
        },
        orderBy: {
          scriptSentence: {
            orderInSegment: 'asc'
          }
        }
      })

      if (audioFiles.length === 0) {
        return {
          success: false,
          error: '该段落没有可合并的音频文件'
        }
      }

      const validAudioFiles = audioFiles
        .map((audioFile) => ({
          ...audioFile,
          resolvedPath: resolveReadableAudioPath(audioFile)
        }))
        .filter((audioFile): audioFile is typeof audioFile & { resolvedPath: string } =>
          Boolean(audioFile.resolvedPath)
        )
      if (validAudioFiles.length === 0) {
        return {
          success: false,
          error: '所有音频文件都不存在'
        }
      }

      const bookId = audioFiles[0].segment!.bookId
      const chapterId = audioFiles[0].segment!.chapterId

      return await mergeAudioFilesWithFFmpeg({
        bookId,
        chapterId,
        title: `segment_${segmentId}`,
        audioPaths: validAudioFiles.map(af => af.resolvedPath),
        options: finalOptions
      })

    } catch (error) {
      console.error('合并段落音频失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * 获取音频合并器实例
 */
export function getAudioMerger(): AudioMerger {
  return new AudioMerger()
}
export type { AudioMergeOptions, AudioMergeResult } from './audio-merger-helpers'
