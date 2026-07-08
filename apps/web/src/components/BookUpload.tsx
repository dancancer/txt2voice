// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 复用 UI
// pos: 共享组件
'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { booksApi } from '@/lib/api'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Progress } from './ui/progress'
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface BookUploadProps {
  onSuccess?: (book: any) => void
  onCancel?: () => void
}

export function BookUpload({ onSuccess, onCancel }: BookUploadProps) {
  const { setUploading, setError, error, addBook } = useAppStore()
  const [formData, setFormData] = useState({
    title: '',
    author: ''
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStep, setUploadStep] = useState<'form' | 'uploading' | 'success' | 'error'>('form')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [autoPipelineWarning, setAutoPipelineWarning] = useState<string | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 验证文件类型
      const allowedTypes = ['.txt', '.md']
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

      if (!allowedTypes.includes(fileExtension)) {
        setError('只支持 .txt 和 .md 文件格式')
        return
      }

      // 验证文件大小 (20MB)
      if (file.size > 20 * 1024 * 1024) {
        setError('文件大小不能超过 20MB')
        return
      }

      setSelectedFile(file)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      setError('请输入书籍标题')
      return
    }

    if (!selectedFile) {
      setError('请选择要上传的文件')
      return
    }

    try {
      setUploadStep('uploading')
      setUploading(true)
      setError(null)
      setAutoPipelineWarning(null)

      // Step 1: Create book
      const bookResponse = await booksApi.createBook({
        title: formData.title.trim(),
        author: formData.author.trim() || undefined
      })

      const book = bookResponse.data
      setUploadProgress(25)

      // Step 2: Upload file
      const uploadResponse = await booksApi.uploadFile(book.id, selectedFile)
      setAutoPipelineWarning(uploadResponse?.data?.autoPipeline?.warning || null)
      setUploadProgress(85)
      const latestBookResponse = await booksApi.getBook(book.id)
      setUploadProgress(100)

      // Success
      setUploadStep('success')

      // Call success callback - let parent component handle the book addition
      const uploadedBook = latestBookResponse.data
      const mergedBook = {
        ...book,
        ...uploadedBook,
        totalSegments: uploadedBook?.totalSegments ?? book.totalSegments ?? 0,
        totalCharacters: uploadedBook?.totalCharacters ?? book.totalCharacters ?? 0,
        status: uploadedBook?.status || book.status || 'uploaded',
      }
      addBook(mergedBook as any)

      if (onSuccess) {
        onSuccess(uploadResponse.data)
      }

      // Reset form after delay
      setTimeout(() => {
        setUploadStep('form')
        setFormData({ title: '', author: '' })
        setSelectedFile(null)
        setUploadProgress(0)
      }, 2000)

    } catch (err) {
      setUploadStep('error')
      setError(err instanceof Error ? err.message : '上传失败')
      setAutoPipelineWarning(null)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const resetForm = () => {
    setUploadStep('form')
    setFormData({ title: '', author: '' })
    setSelectedFile(null)
    setUploadProgress(0)
    setError(null)
    setAutoPipelineWarning(null)
    setUploading(false)
  }

  return (
    <div className="mx-auto max-w-2xl rounded-[1.5rem] border border-border/80 bg-card p-6 text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-card-foreground">上传新书</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              先录入书籍信息，再上传原始文本。系统会继续进入章节识别与后续编排。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.72rem] font-medium text-muted-foreground">
              支持 txt / md
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.72rem] font-medium text-muted-foreground">
              文件上限 20MB
            </Badge>
          </div>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={uploadStep !== 'form'}
            className="rounded-xl"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Form Step */}
      {uploadStep === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-card-foreground">
                书籍标题 <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="请输入书籍标题"
                disabled={uploadStep !== 'form'}
                required
              />
            </div>

            <div>
              <label htmlFor="author" className="mb-2 block text-sm font-medium text-card-foreground">
                作者
              </label>
              <Input
                type="text"
                id="author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="请输入作者名称（可选）"
                disabled={uploadStep !== 'form'}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-card-foreground">
                选择文件 <span className="text-destructive">*</span>
              </label>
              <div className={`rounded-[1.25rem] border-2 border-dashed p-6 text-center transition-colors ${selectedFile ? 'border-primary/25 bg-accent/40' : 'border-border bg-muted/30 hover:border-foreground/20'}`}>
                <input
                  type="file"
                  id="file"
                  accept=".txt,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploadStep !== 'form'}
                />
                <label
                  htmlFor="file"
                  className={`cursor-pointer ${uploadStep !== 'form' ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="mb-2 font-medium text-foreground">
                    点击选择文件或拖拽文件到此处
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    支持 .txt 和 .md 格式，文件大小不超过 20MB
                  </p>
                </label>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between rounded-[1rem] border border-border bg-accent/45 p-3.5">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-accent-foreground" />
                  <div>
                    <p className="text-sm font-medium text-accent-foreground">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  disabled={uploadStep !== 'form'}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center space-x-2 rounded-[1rem] border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={uploadStep !== 'form'}
              >
                取消
              </Button>
            )}
            <Button
              type="submit"
              disabled={!formData.title.trim() || !selectedFile || uploadStep !== 'form'}
            >
              开始上传
            </Button>
          </div>
        </form>
      )}

      {/* Uploading Step */}
      {uploadStep === 'uploading' && (
        <div className="rounded-[1.25rem] border border-border bg-muted/25 py-8 text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
          <h3 className="mb-2 text-lg font-medium text-card-foreground">正在上传文件...</h3>
          <div className="w-full max-w-sm mx-auto">
            <Progress value={uploadProgress} className="mb-2" />
            <p className="text-sm text-muted-foreground">{uploadProgress}%</p>
          </div>
        </div>
      )}

      {/* Success Step */}
      {uploadStep === 'success' && (
        <div className="rounded-[1.25rem] border border-emerald-200/70 bg-emerald-50/80 py-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h3 className="mb-2 text-lg font-medium text-card-foreground">上传成功！</h3>
          {autoPipelineWarning ? (
            <p className="mx-auto max-w-lg text-muted-foreground">
              文件已上传，但自动编排触发失败：{autoPipelineWarning}
            </p>
          ) : (
            <p className="mx-auto max-w-lg text-muted-foreground">书籍已上传，自动编排任务已进入队列</p>
          )}
        </div>
      )}

      {/* Error Step */}
      {uploadStep === 'error' && (
        <div className="rounded-[1.25rem] border border-destructive/15 bg-destructive/5 py-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h3 className="mb-2 text-lg font-medium text-card-foreground">上传失败</h3>
          <p className="mb-4 text-muted-foreground">{error}</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={resetForm}>
              重新填写
            </Button>
            <Button onClick={handleSubmit}>
              重试上传
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
