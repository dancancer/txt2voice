'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Book } from '@/types/book'
import { booksApi, formatFileSize, formatDate, getStatusColor, getStatusText } from '@/lib/api'
import { Button } from './ui/button'
import {
  BookOpen,
  FileText,
  Play,
  Settings,
  Trash2,
  Upload,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface BookCardProps {
  book: Book
  onDelete?: (id: string) => void
  onUpdate?: (book: Book) => void
}

export function BookCard({ book, onDelete, onUpdate }: BookCardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleCardClick = () => {
    router.push(`/books/${book.id}`)
  }

  const handleUploadFile = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.md'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          setIsLoading(true)
          await booksApi.uploadFile(book.id, file)
          await booksApi.processFile(book.id)

          // Update book status
          const updatedBook = await booksApi.getBook(book.id)
          if (onUpdate) {
            onUpdate(updatedBook.data)
          }
        } catch (error) {
          console.error('Upload failed:', error)
          alert('文件上传失败，请重试')
        } finally {
          setIsLoading(false)
        }
      }
    }
    input.click()
  }

  const handleStartProcessing = async () => {
    if (!book.originalFilename) {
      handleUploadFile()
      return
    }

    try {
      setIsLoading(true)
      const response = await booksApi.processFile(book.id)
      if (onUpdate) {
        onUpdate(response.data.book)
      }
    } catch (error) {
      console.error('Processing failed:', error)
      alert('文件处理失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await booksApi.deleteBook(book.id)
      if (onDelete) {
        onDelete(book.id)
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const getStatusIcon = () => {
    switch (book.status) {
      case 'uploaded':
        return <Upload className="w-4 h-4" />
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'processed':
        return <CheckCircle className="w-4 h-4" />
      case 'script_generated':
        return <FileText className="w-4 h-4" />
      case 'generating_audio':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const canGenerateScript = book.status === 'processed'
  const canGenerateAudio = book.status === 'processed' || book.status === 'script_generated'
  const canViewDetails = book.status !== 'uploaded'
  const showViewTaskButton = book.status !== 'uploaded' && book.status !== 'uploading'

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {/* Status Bar */}
      <div className={`px-4 py-2 flex items-center justify-between text-xs font-medium ${getStatusColor(book.status)}`}>
        <div className="flex items-center space-x-1">
          {getStatusIcon()}
          <span>{getStatusText(book.status)}</span>
        </div>
        {book.status === 'processing' && (
          <div className="flex items-center space-x-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>处理中...</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
              {book.title}
            </h3>
            {book.author && (
              <p className="text-sm text-gray-600 mb-2">作者：{book.author}</p>
            )}
            {book.originalFilename && (
              <p className="text-xs text-gray-500 flex items-center">
                <FileText className="w-3 h-3 mr-1" />
                {book.originalFilename}
              </p>
            )}
          </div>
          <div className="flex space-x-1 ml-4">
            {showViewTaskButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCardClick}
                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                title="进入任务"
              >
                <BookOpen className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center text-gray-600">
            <FileText className="w-4 h-4 mr-2 text-gray-400" />
            <span>段落：{book.totalSegments}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <span className="w-4 h-4 mr-2 text-gray-400 text-center">字</span>
            <span>字符：{book.totalCharacters.toLocaleString()}</span>
          </div>
          {book.fileSize && (
            <div className="flex items-center text-gray-600">
              <span className="w-4 h-4 mr-2 text-gray-400 text-center">💾</span>
              <span>{formatFileSize(book.fileSize)}</span>
            </div>
          )}
          <div className="flex items-center text-gray-600">
            <Clock className="w-4 h-4 mr-2 text-gray-400" />
            <span>{formatDate(book.createdAt)}</span>
          </div>
        </div>

        {/* Audio Files Count */}
        {book._count?.audioFiles && book._count.audioFiles > 0 && (
          <div className="mb-4 p-2 bg-green-50 rounded-md">
            <div className="flex items-center text-sm text-green-800">
              <Play className="w-4 h-4 mr-2" />
              <span>已生成 {book._count.audioFiles} 个音频文件</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          {book.status === 'uploaded' && !book.originalFilename && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadFile}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  上传文件
                </>
              )}
            </Button>
          )}

          {book.status === 'uploaded' && book.originalFilename && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartProcessing}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  开始处理
                </>
              )}
            </Button>
          )}

          {canGenerateScript && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/books/${book.id}/script`)}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              生成台本
            </Button>
          )}

          {canGenerateAudio && (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/books/${book.id}/audio`)}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              生成音频
            </Button>
          )}

          {book.status === 'completed' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/books/${book.id}/play`)}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              播放音频
            </Button>
          )}

          {/* Delete Button */}
          {!showDeleteConfirm ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
