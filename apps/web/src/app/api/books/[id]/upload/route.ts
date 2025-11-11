import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, FileProcessingError, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'
import { CONFIG } from '@/lib/constants'
import { sanitizeFilename, validateFilePath, validateBookExists } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// POST /api/books/[id]/upload - 上传文件
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params

  // 验证书籍是否存在
  const book = await validateBookExists(bookId)

  const formData = await request.formData()
  const file = formData.get('file') as File

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
  const uploadsDir = join(process.cwd(), 'uploads', 'books', bookId)
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

  // 读取文件内容进行基础验证
  let content: string
  try {
    content = buffer.toString('utf-8')

    // 检查文件内容是否为空或只包含空白字符
    if (!content.trim()) {
      throw new FileProcessingError(
        '文件内容为空',
        'CORRUPTED_FILE',
        { message: '文件不包含任何有效文本内容' }
      )
    }

    // 检查内容长度（防止异常大的文件）
    if (content.length > CONFIG.FILE_UPLOAD.MAX_TEXT_LENGTH) {
      throw new FileProcessingError(
        '文本内容过长',
        'FILE_TOO_LARGE',
        {
          maxTextLength: `${CONFIG.FILE_UPLOAD.MAX_TEXT_LENGTH / 1024 / 1024}MB`,
          actualLength: `${(content.length / 1024 / 1024).toFixed(2)}MB`
        }
      )
    }

  } catch (error) {
    if (error instanceof FileProcessingError) {
      throw error
    }
    throw new FileProcessingError(
      '文件读取失败，可能文件已损坏',
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

  return NextResponse.json({
    success: true,
    data: {
      id: updatedBook.id,
      originalFilename: file.name,
      size: file.size,
      uploadedAt: updatedBook.updatedAt,
      contentPreview: content.slice(0, 200) + (content.length > 200 ? '...' : '')
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