import type { Book, BookStatus } from '@/types/book'
import { getBookStatusMeta } from './status'

const API_BASE = '/api/books'

export interface CreateBookRequest {
  title: string
  author?: string
}

export interface BookResponse {
  success: boolean
  data: Book
}

export interface BooksResponse {
  success: boolean
  data: Book[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 书籍相关API
export const booksApi = {
  // 获取书籍列表
  async getBooks(page = 1, limit = 10): Promise<BooksResponse> {
    const response = await fetch(`${API_BASE}?page=${page}&limit=${limit}`)
    if (!response.ok) {
      throw new Error('Failed to fetch books')
    }
    return response.json()
  },

  // 创建新书籍
  async createBook(data: CreateBookRequest): Promise<BookResponse> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to create book')
    }
    return response.json()
  },

  // 获取单本书籍详情
  async getBook(id: string, include?: string[]): Promise<BookResponse> {
    const params = include && include.length > 0
      ? `?include=${include.join(',')}`
      : ''
    const response = await fetch(`${API_BASE}/${id}${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch book')
    }
    return response.json()
  },

  // 更新书籍信息
  async updateBook(id: string, data: Partial<Book>): Promise<BookResponse> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to update book')
    }
    return response.json()
  },

  // 删除书籍
  async deleteBook(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete book')
    }
    return response.json()
  },

  // 上传文件
  async uploadFile(id: string, file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/${id}/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      throw new Error('Failed to upload file')
    }
    return response.json()
  },

  // 处理文件内容
  async processFile(id: string, options?: any): Promise<any> {
    const response = await fetch(`${API_BASE}/${id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ options }),
    })
    if (!response.ok) {
      throw new Error('Failed to process file')
    }
    return response.json()
  },

  // 获取处理状态
  async getProcessingStatus(id: string): Promise<any> {
    const response = await fetch(`${API_BASE}/${id}/process`)
    if (!response.ok) {
      throw new Error('Failed to get processing status')
    }
    return response.json()
  },

  // 获取音频生成状态
  async getAudioGenerationStatus(id: string): Promise<any> {
    const response = await fetch(`${API_BASE}/${id}/audio/generate?includeProgress=true`)
    if (!response.ok) {
      throw new Error('Failed to get audio generation status')
    }
    return response.json()
  },

  // 开始音频生成
  async startAudioGeneration(id: string, options: any): Promise<any> {
    const response = await fetch(`${API_BASE}/${id}/audio/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })
    if (!response.ok) {
      throw new Error('Failed to start audio generation')
    }
    return response.json()
  }
}

// 工具函数
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown size'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const getStatusColor = (status: BookStatus): string =>
  getBookStatusMeta(status).className

export const getStatusText = (status: BookStatus): string =>
  getBookStatusMeta(status).label

export { getBookStatusMeta }
