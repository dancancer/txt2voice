/**
 * API 工具函数
 * 提取公共的 API 逻辑
 */

import prisma from './prisma'
import { ValidationError } from './error-handler'
import { Book } from '@/generated/prisma'
import { basename } from 'path'
import { CONFIG, FILENAME_SANITIZE_REGEX } from './constants'

/**
 * 验证书籍是否存在
 */
export async function validateBookExists(bookId: string): Promise<Book> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  return book
}

/**
 * 验证书籍是否已上传文件
 */
export function validateBookHasFile(book: Book): void {
  if (!book.uploadedFilePath) {
    throw new ValidationError('请先上传文件', 'file')
  }
}

/**
 * 验证书籍状态
 */
export function validateBookStatus(
  book: Book,
  allowedStatuses: Book['status'][]
): void {
  if (!allowedStatuses.includes(book.status)) {
    throw new ValidationError(
      `书籍状态必须是 ${allowedStatuses.join(', ')} 之一，当前状态: ${book.status}`
    )
  }
}

/**
 * 清理文件名，防止路径遍历攻击
 */
export function sanitizeFilename(filename: string): string {
  // 只保留文件名部分
  const name = basename(filename)
  
  // 替换非法字符
  const sanitized = name.replace(FILENAME_SANITIZE_REGEX, '_')
  
  // 限制长度
  return sanitized.slice(0, 255)
}

/**
 * 验证文件路径是否在允许的目录内
 */
export function validateFilePath(filePath: string, allowedDir: string): boolean {
  return filePath.startsWith(allowedDir)
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 解析分页参数
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number
  limit: number
  skip: number
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(
    CONFIG.PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get('limit') || String(CONFIG.PAGINATION.DEFAULT_LIMIT), 10))
  )
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * 创建分页响应
 */
export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  }
}
