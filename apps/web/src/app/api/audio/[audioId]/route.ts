// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { resolveExistingAudioFilePath } from '@/lib/storage-path'

const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'audio/webm'
}

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) => {
  const { audioId } = await params
  const audioFile = await prisma.audioFile.findUnique({
    where: { id: audioId },
    select: {
      id: true,
      bookId: true,
      filePath: true,
      fileName: true,
      format: true,
      provider: true,
      status: true
    }
  })

  if (!audioFile) {
    throw new ValidationError('音频文件不存在')
  }

  const resolvedPath = resolveExistingAudioFilePath({
    filePath: audioFile.filePath,
    fileName: audioFile.fileName,
    bookId: audioFile.bookId,
    provider: audioFile.provider
  })

  if (!resolvedPath) {
    if (audioFile.status !== 'failed') {
      await prisma.audioFile.update({
        where: { id: audioFile.id },
        data: {
          status: 'failed',
          errorMessage: '音频文件丢失，需重新生成'
        }
      }).catch((error) => {
        console.warn('Failed to mark missing audio file:', error)
      })
    }

    throw new ValidationError('音频文件不存在或存储路径失效，请重新生成音频')
  }

  if (resolvedPath !== audioFile.filePath || audioFile.status !== 'completed') {
    await prisma.audioFile.update({
      where: { id: audioFile.id },
      data: {
        filePath: resolvedPath,
        status: 'completed',
        errorMessage: null
      }
    }).catch((error) => {
      console.warn('Failed to update audio file path:', error)
    })
  }

  try {
    const data = await readFile(resolvedPath)
    const format = (audioFile.format || 'mp3').toLowerCase()
    const contentType = MIME_MAP[format] || 'audio/mpeg'

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': data.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error) {
    console.error('Failed to read audio file:', error)
    if (audioFile.status !== 'failed') {
      await prisma.audioFile.update({
        where: { id: audioFile.id },
        data: {
          status: 'failed',
          errorMessage: '音频读取失败，需重新生成'
        }
      }).catch((updateError) => {
        console.warn('Failed to mark unreadable audio file:', updateError)
      })
    }
    throw new ValidationError('音频文件无法读取，请重新生成后再试')
  }
})
