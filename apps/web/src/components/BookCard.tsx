// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 复用 UI
// pos: 共享组件
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Book } from '@/types/book'
import { booksApi, formatFileSize, formatDate, getBookStatusMeta } from '@/lib/api'
import { Button } from './ui/button'
import { toast } from 'sonner'
import {
  BookOpen,
  FileText,
  Play,
  Settings,
  Trash2,
  Upload,
  Loader2,
  Clock,
  HardDrive,
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
  const statusMeta = getBookStatusMeta(book.status)
  const StatusIcon = statusMeta.icon

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
          const uploadResult = await booksApi.uploadFile(book.id, file)

          if (uploadResult?.data?.autoPipeline?.warning) {
            toast.warning(`上传成功，但自动编排未启动：${uploadResult.data.autoPipeline.warning}`)
          } else if (uploadResult?.data?.autoPipeline?.reused) {
            toast.success('上传成功，已复用正在执行的自动编排任务')
          } else if (uploadResult?.data?.autoPipeline?.triggered) {
            toast.success('上传成功，已自动触发编排任务')
          } else {
            toast.success('上传成功')
          }

          // Update book status
          const updatedBook = await booksApi.getBook(book.id)
          if (onUpdate) {
            onUpdate(updatedBook.data)
          }
        } catch (error) {
          console.error('Upload failed:', error)
          toast.error('文件上传失败，请重试')
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
      const response = await booksApi.startAutoPipeline(book.id)
      if (response?.data?.reused) {
        toast.info('自动编排任务已在执行中，已返回当前任务')
      } else {
        toast.success('自动编排任务已启动')
      }
      const updatedBook = await booksApi.getBook(book.id)
      if (onUpdate) {
        onUpdate(updatedBook.data)
      }
    } catch (error) {
      console.error('Processing failed:', error)
      toast.error('自动编排启动失败，请重试')
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
      toast.error('删除失败，请重试')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const canGenerateScript = book.status === 'processed' || book.status === 'completed_with_errors'
  const canGenerateAudio =
    book.status === 'processed' ||
    book.status === 'script_generated' ||
    book.status === 'completed_with_errors'
  const audioFilesCount = book.counts?.audioFiles ?? 0
  const hasAudio = audioFilesCount > 0
  const showViewTaskButton = book.status !== 'uploaded' && book.status !== 'uploading'

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/80 bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_28px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/10 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08),0_18px_42px_rgba(15,23,42,0.08)]">
      <div className="flex h-full flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
                <StatusIcon className={`h-3.5 w-3.5 ${statusMeta.animated ? 'animate-spin' : ''}`} />
                {statusMeta.label}
              </span>
              {book.status === 'processing' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[0.72rem] font-medium text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  处理中
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <h3 className="line-clamp-2 text-xl font-semibold leading-7 text-card-foreground">
                {book.title}
              </h3>
              {book.author ? (
                <p className="text-sm text-muted-foreground">作者：{book.author}</p>
              ) : null}
              {book.originalFilename ? (
                <p className="flex items-center gap-1.5 text-xs leading-5 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-1 break-all">{book.originalFilename}</span>
                </p>
              ) : null}
            </div>
          </div>
          {showViewTaskButton ? (
            <Button
              variant="outline"
              size="icon"
              onClick={handleCardClick}
              title="进入任务"
              aria-label="进入书籍详情"
              className="rounded-xl"
            >
              <BookOpen className="w-4 h-4" />
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-[1rem] border border-border/70 bg-muted/30 p-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>段落</span>
            </div>
            <p className="font-medium text-foreground">{book.totalSegments}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-flex h-4 w-4 items-center justify-center text-[11px] font-semibold">字</span>
              <span>字符</span>
            </div>
            <p className="font-medium text-foreground">{book.totalCharacters.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              <span>文件大小</span>
            </div>
            <p className="font-medium text-foreground">{book.fileSize ? formatFileSize(book.fileSize) : '待上传'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>创建时间</span>
            </div>
            <p className="font-medium text-foreground">{formatDate(book.createdAt)}</p>
          </div>
        </div>

        {audioFilesCount > 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-[1rem] border border-emerald-200/70 bg-emerald-50/80 px-3.5 py-3 text-sm text-emerald-900">
            <Play className="h-4 w-4 shrink-0" />
            <span>已生成 {audioFilesCount} 个音频文件，可直接进入播放或继续补齐缺失片段。</span>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {book.status === 'uploaded' && !book.originalFilename && (
            <Button
              variant="outline"
              onClick={handleUploadFile}
              disabled={isLoading}
              className="min-w-[9.5rem] flex-1"
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
              onClick={handleStartProcessing}
              disabled={isLoading}
              className="min-w-[9.5rem] flex-1"
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
              onClick={() => router.push(`/books/${book.id}`)}
              className="min-w-[9.5rem] flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              章节详情
            </Button>
          )}

          {canGenerateAudio && (
            <Button
              variant="default"
              onClick={() => router.push(`/books/${book.id}`)}
              className="min-w-[9.5rem] flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              章节音频
            </Button>
          )}

          {(book.status === 'completed' ||
            book.status === 'completed_with_errors' ||
            book.status === 'audio_review_ready') && hasAudio && (
            <Button
              variant="default"
              onClick={() => router.push(`/books/${book.id}/play`)}
              className="min-w-[9.5rem] flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              播放音频
            </Button>
          )}

          {/* Delete Button */}
          {!showDeleteConfirm ? (
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="min-w-[44px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="删除书籍"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex flex-1 flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="min-w-[7rem] flex-1"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="min-w-[8rem] flex-1"
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
