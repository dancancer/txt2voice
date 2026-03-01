// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'

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
      filePath: true,
      format: true
    }
  })

  if (!audioFile) {
    throw new ValidationError('音频文件不存在')
  }

  try {
    const data = await readFile(audioFile.filePath)
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
    throw new ValidationError('音频文件无法读取或已被删除')
  }
})
