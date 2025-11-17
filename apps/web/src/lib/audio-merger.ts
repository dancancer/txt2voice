import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import prisma from './prisma'

const execAsync = promisify(exec)

export interface AudioMergeOptions {
  /**
   * 输出格式
   */
  format?: 'mp3' | 'wav' | 'ogg'
  /**
   * 音频质量（比特率）
   */
  bitrate?: string
  /**
   * 台词之间的静音间隔（秒）
   */
  silenceDuration?: number
  /**
   * 是否归一化音量
   */
  normalizeVolume?: boolean
}

export interface AudioMergeResult {
  success: boolean
  outputPath?: string
  fileName?: string
  fileSize?: number
  duration?: number
  error?: string
  metadata?: {
    audioFileCount: number
    totalDuration: number
    format: string
  }
}

/**
 * 音频合并工具类
 */
export class AudioMerger {
  private readonly defaultOptions: AudioMergeOptions = {
    format: 'mp3',
    bitrate: '128k',
    silenceDuration: 0.5,
    normalizeVolume: false
  }

  /**
   * 检查 ffmpeg 是否可用
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version')
      return true
    } catch (error) {
      console.error('FFmpeg not available:', error)
      return false
    }
  }

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
      const ffmpegAvailable = await this.checkFFmpegAvailable()
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

      // 验证所有音频文件是否存在
      const missingFiles = audioFiles.filter(af => !existsSync(af.filePath))
      if (missingFiles.length > 0) {
        console.warn(`发现 ${missingFiles.length} 个缺失的音频文件`)
      }

      const validAudioFiles = audioFiles.filter(af => existsSync(af.filePath))
      if (validAudioFiles.length === 0) {
        return {
          success: false,
          error: '所有音频文件都不存在'
        }
      }

      // 使用 ffmpeg 合并音频
      const result = await this.mergeAudioFilesWithFFmpeg(
        bookId,
        chapterId,
        chapter.title,
        validAudioFiles.map(af => af.filePath),
        finalOptions
      )

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
      const ffmpegAvailable = await this.checkFFmpegAvailable()
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

      const validAudioFiles = audioFiles.filter(af => existsSync(af.filePath))
      if (validAudioFiles.length === 0) {
        return {
          success: false,
          error: '所有音频文件都不存在'
        }
      }

      // 使用 ffmpeg 合并音频
      const result = await this.mergeAudioFilesWithFFmpeg(
        bookId,
        null,
        book.title,
        validAudioFiles.map(af => af.filePath),
        finalOptions
      )

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
   * 使用 ffmpeg 合并音频文件
   */
  private async mergeAudioFilesWithFFmpeg(
    bookId: string,
    chapterId: string | null,
    title: string,
    audioPaths: string[],
    options: AudioMergeOptions
  ): Promise<AudioMergeResult> {
    const timestamp = Date.now()
    const tempDir = join(process.cwd(), 'uploads', 'temp')
    const outputDir = join(process.cwd(), 'uploads', 'audio', bookId, 'merged')

    try {
      // 确保目录存在
      await mkdir(tempDir, { recursive: true })
      await mkdir(outputDir, { recursive: true })

      // 创建临时文件列表
      const listFilePath = join(tempDir, `filelist_${timestamp}.txt`)
      const fileListContent = audioPaths
        .map(path => `file '${path.replace(/'/g, "'\\''")}'`)
        .join('\n')

      await writeFile(listFilePath, fileListContent, 'utf-8')

      // 生成输出文件名
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
      const chapterSuffix = chapterId ? `_chapter_${timestamp}` : `_full_${timestamp}`
      const fileName = `${sanitizedTitle}${chapterSuffix}.${options.format}`
      const outputPath = join(outputDir, fileName)

      // 构建 ffmpeg 命令
      let ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${listFilePath}"`

      // 添加静音间隔（如果需要）
      if (options.silenceDuration && options.silenceDuration > 0) {
        // 注意：为音频间添加静音需要更复杂的处理
        // 这里我们先使用简单的拼接
        ffmpegCommand += ` -c copy`
      } else {
        ffmpegCommand += ` -c copy`
      }

      // 添加音频参数
      if (options.bitrate && options.format === 'mp3') {
        ffmpegCommand = ffmpegCommand.replace('-c copy', `-c:a libmp3lame -b:a ${options.bitrate}`)
      }

      ffmpegCommand += ` "${outputPath}"`

      console.log(`执行 ffmpeg 命令: ${ffmpegCommand}`)

      // 执行合并
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      })

      if (stderr) {
        console.log('FFmpeg stderr:', stderr)
      }

      // 清理临时文件
      try {
        await unlink(listFilePath)
      } catch (error) {
        console.warn('清理临时文件失败:', error)
      }

      // 获取输出文件信息
      const stats = await import('fs').then(fs => fs.statSync(outputPath))
      const totalDuration = audioPaths.length * 5 // 简单估算，实际应该解析音频文件

      return {
        success: true,
        outputPath,
        fileName,
        fileSize: stats.size,
        duration: totalDuration,
        metadata: {
          audioFileCount: audioPaths.length,
          totalDuration,
          format: options.format || 'mp3'
        }
      }

    } catch (error) {
      console.error('FFmpeg 合并失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'FFmpeg execution failed'
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

      const validAudioFiles = audioFiles.filter(af => existsSync(af.filePath))
      if (validAudioFiles.length === 0) {
        return {
          success: false,
          error: '所有音频文件都不存在'
        }
      }

      const bookId = audioFiles[0].segment!.bookId
      const chapterId = audioFiles[0].segment!.chapterId

      return await this.mergeAudioFilesWithFFmpeg(
        bookId,
        chapterId,
        `segment_${segmentId}`,
        validAudioFiles.map(af => af.filePath),
        finalOptions
      )

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
