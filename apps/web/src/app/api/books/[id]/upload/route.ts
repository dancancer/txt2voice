// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/上传与自动编排参数
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, FileProcessingError, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { CONFIG } from '@/lib/constants'
import { sanitizeFilename, validateFilePath, validateBookExists } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { getBookUploadDir } from '@/lib/storage-path'
import { join } from 'path'
import {
  parseAutoPipelineOptions,
  type AutoPipelineOptions
} from '@/lib/auto-pipeline-runner'
import {
  scheduleAutoPipelineCompensationTask,
  startAutoPipelineTask
} from '@/lib/auto-pipeline-trigger-service'
import { ensureTaskWorkerStarted } from '@/lib/task-queue'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

const parseBooleanFormField = (
  value: FormDataEntryValue | null,
  fieldName: string,
  defaultValue: boolean
): boolean => {
  if (value === null) {
    return defaultValue
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} 参数格式错误`, fieldName)
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return defaultValue
  }
  if (TRUE_VALUES.has(normalized)) {
    return true
  }
  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  throw new ValidationError(`${fieldName} 参数格式错误`, fieldName)
}

const parseAutoPipelineOptionsField = (
  value: FormDataEntryValue | null
): AutoPipelineOptions => {
  if (value === null) {
    return {}
  }
  if (typeof value !== 'string') {
    throw new ValidationError('autoPipelineOptions 参数格式错误', 'autoPipelineOptions')
  }

  const normalized = value.trim()
  if (!normalized) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch {
    throw new ValidationError('autoPipelineOptions 不是合法 JSON', 'autoPipelineOptions')
  }

  return parseAutoPipelineOptions(parsed)
}

// POST /api/books/[id]/upload - 上传文件
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params

  // 验证书籍是否存在
  await validateBookExists(bookId)

  const formData = await request.formData()
  const file = formData.get('file') as File
  const autoPipelineEnabled = parseBooleanFormField(
    formData.get('autoPipelineEnabled') ?? formData.get('autoStartPipeline'),
    'autoPipelineEnabled',
    true
  )
  const autoPipelineOptions = parseAutoPipelineOptionsField(
    formData.get('autoPipelineOptions')
  )
  const presetField = formData.get('autoPipelinePresetId')
  const autoPipelinePresetId =
    typeof presetField === 'string' && presetField.trim()
      ? presetField.trim()
      : undefined

  if (!file) {
    throw new ValidationError('未选择文件', 'file')
  }

  // 验证文件大小
  if (file.size > CONFIG.FILE_UPLOAD.MAX_SIZE) {
    throw new FileProcessingError(
      '文件大小超过限制',
      'FILE_TOO_LARGE',
      {
        maxSize: `${CONFIG.FILE_UPLOAD.MAX_SIZE / 1024 / 1024}MB`,
        actualSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
      }
    )
  }

  // 验证文件格式
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!CONFIG.FILE_UPLOAD.ALLOWED_EXTENSIONS.includes(fileExtension as '.txt' | '.md')) {
    throw new FileProcessingError(
      '不支持的文件格式',
      'INVALID_FORMAT',
      {
        allowedFormats: CONFIG.FILE_UPLOAD.ALLOWED_EXTENSIONS.join(', '),
        actualFormat: fileExtension
      }
    )
  }

  // 创建上传目录
  const uploadsDir = getBookUploadDir(bookId)
  try {
    await mkdir(uploadsDir, { recursive: true })
  } catch (error) {
    logger.error('Failed to create upload directory', error)
  }

  // 保存文件 - 清理文件名防止路径遍历攻击
  const timestamp = Date.now()
  const sanitizedFilename = sanitizeFilename(file.name)
  const savedFilename = `${timestamp}_${sanitizedFilename}`
  const filePath = join(uploadsDir, savedFilename)

  // 验证最终路径在预期目录内
  if (!validateFilePath(filePath, uploadsDir)) {
    throw new FileProcessingError(
      '无效的文件路径',
      'INVALID_FORMAT',
      { message: '文件路径验证失败' }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  try {
    await writeFile(filePath, buffer)
  } catch (error) {
    throw new FileProcessingError(
      '文件保存失败',
      'CORRUPTED_FILE',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )
  }

  // 更新书籍记录
  const updatedBook = await prisma.book.update({
    where: { id: bookId },
    data: {
      originalFilename: file.name,
      uploadedFilePath: filePath,
      status: 'uploaded'
    }
  })

  let autoPipelineResult: Awaited<ReturnType<typeof startAutoPipelineTask>> | null = null
  let autoPipelineWarning: string | null = null
  let autoPipelineCompensationTaskId: string | null = null
  let autoPipelineCompensationScheduled = false

  if (autoPipelineEnabled) {
    try {
      await ensureTaskWorkerStarted()
      autoPipelineResult = await startAutoPipelineTask({
        bookId,
        options: autoPipelineOptions,
        presetId: autoPipelinePresetId,
        triggerSource: 'upload_api',
        triggerMetadata: {
          filename: file.name,
          size: file.size,
          uploadedAt: updatedBook.updatedAt.toISOString()
        },
        allowReuseRunningTask: true
      })
    } catch (error) {
      autoPipelineWarning = error instanceof Error ? error.message : '自动编排触发失败'
      logger.warn('Upload succeeded but auto pipeline trigger failed', {
        bookId,
        warning: autoPipelineWarning
      })

      try {
        const compensationResult = await scheduleAutoPipelineCompensationTask({
          bookId,
          options: autoPipelineOptions,
          presetId: autoPipelinePresetId,
          originalTriggerSource: 'upload_api',
          triggerMetadata: {
            filename: file.name,
            size: file.size,
            uploadedAt: updatedBook.updatedAt.toISOString()
          },
          triggerFailure: autoPipelineWarning
        })
        autoPipelineCompensationTaskId = compensationResult.taskId
        autoPipelineCompensationScheduled = compensationResult.status === 'scheduled'
        if (compensationResult.status !== 'scheduled') {
          autoPipelineWarning = `${autoPipelineWarning}；补偿任务已创建但入队失败`
        }
      } catch (compensationError) {
        const compensationMessage = compensationError instanceof Error
          ? compensationError.message
          : '上传补偿任务创建失败'
        autoPipelineWarning = `${autoPipelineWarning}；补偿任务创建失败：${compensationMessage}`
        logger.warn('Upload compensation scheduling failed', {
          bookId,
          warning: compensationMessage
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: updatedBook.id,
      originalFilename: file.name,
      size: file.size,
      uploadedAt: updatedBook.updatedAt,
      contentPreview: null,
      autoPipeline: {
        enabled: autoPipelineEnabled,
        triggered: Boolean(autoPipelineResult),
        reused: autoPipelineResult?.reused || false,
        taskId: autoPipelineResult?.taskId || null,
        totalStages: autoPipelineResult?.totalStages || null,
        qualityCheckEnabled: autoPipelineResult?.qualityCheckEnabled || null,
        compensationTaskId: autoPipelineCompensationTaskId,
        compensationScheduled: autoPipelineCompensationScheduled,
        warning: autoPipelineWarning
      }
    }
  })
})

// GET /api/books/[id]/upload - 获取上传状态
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      originalFilename: true,
      uploadedFilePath: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  return NextResponse.json({
    success: true,
    data: {
      hasUpload: !!book.uploadedFilePath,
      filename: book.originalFilename,
      status: book.status,
      uploadedAt: book.updatedAt
    }
  })
})
