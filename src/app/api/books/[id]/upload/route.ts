import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, FileProcessingError, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_EXTENSIONS = ['.txt', '.md']

// POST /api/books/[id]/upload - 上传文件
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params

  // 验证书籍是否存在
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    throw new ValidationError('未选择文件', 'file')
  }

  // 验证文件大小
  if (file.size > MAX_FILE_SIZE) {
    throw new FileProcessingError(
      '文件大小超过限制',
      'FILE_TOO_LARGE',
      {
        maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
        actualSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
      }
    )
  }

  // 验证文件格式
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    throw new FileProcessingError(
      '不支持的文件格式',
      'INVALID_FORMAT',
      {
        allowedFormats: ALLOWED_EXTENSIONS.join(', '),
        actualFormat: fileExtension
      }
    )
  }

  // 创建上传目录
  const uploadsDir = join(process.cwd(), 'uploads', 'books', bookId)
  try {
    await mkdir(uploadsDir, { recursive: true })
  } catch (error) {
    console.error('Failed to create upload directory:', error)
  }

  // 保存文件
  const timestamp = Date.now()
  const savedFilename = `${timestamp}_${file.name}`
  const filePath = join(uploadsDir, savedFilename)

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
    if (content.length > 10 * 1024 * 1024) { // 10MB 文本限制
      throw new FileProcessingError(
        '文本内容过长',
        'FILE_TOO_LARGE',
        {
          maxTextLength: '10MB',
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