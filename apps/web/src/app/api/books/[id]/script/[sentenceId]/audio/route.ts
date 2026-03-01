// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma, { Prisma } from '@/lib/prisma'
import { indexTTSService, EmotionVector } from '@/lib/indextts-service'
import { mkdir, writeFile, stat } from 'fs/promises'
import { join, extname } from 'path'

interface GenerateAudioBody {
  speakerBindingId?: string
  emotionOverride?: string
}

const emotionMappings: Array<{ keywords: string[]; vector: EmotionVector }> = [
  {
    keywords: ['喜', '乐', '开心', '高兴', '愉快', 'happy', 'joy'],
    vector: { happy: 0.9, angry: 0.05, sad: 0.05, afraid: 0.05, disgusted: 0.05, melancholic: 0.1, surprised: 0.4, calm: 0.2 }
  },
  {
    keywords: ['激动', '兴奋', '热血', 'excited'],
    vector: { happy: 0.75, angry: 0.15, sad: 0.05, afraid: 0.05, disgusted: 0.05, melancholic: 0.05, surprised: 0.6, calm: 0.1 }
  },
  {
    keywords: ['怒', '愤怒', '生气', '恼火', 'angry'],
    vector: { happy: 0.05, angry: 0.95, sad: 0.1, afraid: 0.15, disgusted: 0.4, melancholic: 0.1, surprised: 0.1, calm: 0.05 }
  },
  {
    keywords: ['悲', '难过', '伤心', '忧郁', '忧伤', '失落', 'sad'],
    vector: { happy: 0.05, angry: 0.05, sad: 0.9, afraid: 0.2, disgusted: 0.05, melancholic: 0.7, surprised: 0.05, calm: 0.2 }
  },
  {
    keywords: ['恐惧', '害怕', '担心', '紧张', 'afraid', 'fear'],
    vector: { happy: 0.05, angry: 0.05, sad: 0.35, afraid: 0.9, disgusted: 0.05, melancholic: 0.3, surprised: 0.35, calm: 0.05 }
  },
  {
    keywords: ['厌恶', '反感', 'disgust'],
    vector: { happy: 0.05, angry: 0.35, sad: 0.15, afraid: 0.1, disgusted: 0.95, melancholic: 0.2, surprised: 0.05, calm: 0.05 }
  },
  {
    keywords: ['惊讶', '惊喜', 'surprise'],
    vector: { happy: 0.5, angry: 0.05, sad: 0.05, afraid: 0.2, disgusted: 0.05, melancholic: 0.05, surprised: 0.95, calm: 0.05 }
  },
  {
    keywords: ['平静', '冷静', '温柔', 'calm', 'neutral'],
    vector: { happy: 0.2, angry: 0.05, sad: 0.1, afraid: 0.05, disgusted: 0.05, melancholic: 0.1, surprised: 0.05, calm: 0.9 }
  }
]

const NEUTRAL_VECTOR: EmotionVector = {
  happy: 0.2,
  angry: 0.1,
  sad: 0.15,
  afraid: 0.1,
  disgusted: 0.05,
  melancholic: 0.2,
  surprised: 0.1,
  calm: 0.5
}

const resolveEmotionVector = (tone?: string): EmotionVector | undefined => {
  if (!tone) return undefined
  const normalized = tone.trim().toLowerCase()
  const match = emotionMappings.find(mapping =>
    mapping.keywords.some(keyword => normalized.includes(keyword.toLowerCase()))
  )

  if (match) {
    return match.vector
  }

  if (normalized === 'neutral') {
    return NEUTRAL_VECTOR
  }

  return undefined
}

const getReferenceAudio = (binding: any): string | undefined => {
  const metadata = (binding.metadata as Record<string, any> | undefined) || {}
  const speakerAudio = binding.speakerProfile?.referenceAudio as string | undefined
  const metadataAudio = (metadata.uploadData as Record<string, any> | undefined)?.filename
    || (metadata.referenceAudio as string | undefined)
  return speakerAudio || metadataAudio
}

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sentenceId: string }> }
) => {
  const { id: bookId, sentenceId } = await params
  let payload: GenerateAudioBody = {}

  if (request.headers.get('content-length')) {
    try {
      payload = await request.json()
    } catch (error) {
      // ignore body parse error and fallback to defaults
    }
  }

  const sentence = await prisma.scriptSentence.findUnique({
    where: { id: sentenceId },
    include: {
      character: {
        include: {
          speakerBindings: {
            include: { speakerProfile: true },
            orderBy: [
              { isDefault: 'desc' },
              { createdAt: 'desc' }
            ]
          }
        }
      }
    }
  })

  if (!sentence || sentence.bookId !== bookId) {
    throw new ValidationError('台词不存在或不属于当前书籍')
  }

  if (!sentence.character) {
    throw new ValidationError('该台词尚未绑定角色，无法生成语音')
  }

  const speakerBindings = sentence.character.speakerBindings || []
  if (speakerBindings.length === 0) {
    throw new ValidationError('该角色还没有关联说话人，请先配置说话人绑定')
  }

  let binding = speakerBindings.find(b => b.id === payload.speakerBindingId)
  if (!binding) {
    binding = speakerBindings.find(b => b.isDefault) || speakerBindings[0]
  }

  const referenceAudio = getReferenceAudio(binding)
  if (!referenceAudio) {
    throw new ValidationError('所选说话人没有可用的参考音频')
  }

  const tone = payload.emotionOverride || sentence.tone
  const emotionVector = resolveEmotionVector(tone || undefined)

  const synthesizeResult = await indexTTSService.synthesizeAndWait(
    {
      text: sentence.text,
      referenceAudio,
      emoControlMethod: emotionVector ? 'Use emotion vectors' : 'Same as the voice reference',
      ...(emotionVector && { emotionVector, emotionWeight: 0.85 })
    },
    { timeout: 120000, interval: 3000 }
  )

  if (!synthesizeResult.audioUrl) {
    throw new ValidationError('TTS服务没有返回音频结果')
  }

  const audioResponse = await fetch(synthesizeResult.audioUrl)
  if (!audioResponse.ok) {
    throw new ValidationError('下载生成的音频失败，请稍后重试')
  }

  const buffer = Buffer.from(await audioResponse.arrayBuffer())
  const audioDir = join(process.cwd(), 'uploads', 'audio', bookId)
  await mkdir(audioDir, { recursive: true })

  const audioUrl = synthesizeResult.audioUrl
  let extension = '.mp3'
  try {
    const parsed = audioUrl.startsWith('http') ? new URL(audioUrl) : undefined
    extension = extname(parsed ? parsed.pathname : audioUrl) || extension
  } catch (error) {
    // ignore URL parse error and fall back to default extension
  }

  const filename = `${sentence.id}-${Date.now()}${extension}`
  const filePath = join(audioDir, filename)
  await writeFile(filePath, buffer)
  const fileStats = await stat(filePath)

  const audioFile = await prisma.audioFile.create({
    data: {
      bookId,
      sentenceId: sentence.id,
      segmentId: sentence.segmentId,
      fileName: filename,
      filePath,
      format: extension.replace('.', '') || 'mp3',
      fileSize: BigInt(fileStats.size),
      duration: typeof synthesizeResult.duration === 'number'
        ? new Prisma.Decimal(synthesizeResult.duration.toFixed(2))
        : null,
      status: 'completed',
      provider: 'indextts'
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      audioFileId: audioFile.id,
      playbackUrl: `/api/audio/${audioFile.id}`,
      provider: 'indextts',
      duration: audioFile.duration,
      fileSize: Number(fileStats.size)
    }
  })
})
