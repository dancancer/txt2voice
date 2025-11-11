'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { booksApi } from '@/lib/api'
import { Button } from './ui/button'
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
  const [uploadStep, setUploadStep] = useState<'form' | 'uploading' | 'processing' | 'success' | 'error'>('form')
  const [uploadProgress, setUploadProgress] = useState(0)

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

      // Step 1: Create book
      const bookResponse = await booksApi.createBook({
        title: formData.title.trim(),
        author: formData.author.trim() || undefined
      })

      const book = bookResponse.data
      setUploadProgress(25)

      // Step 2: Upload file
      const uploadResponse = await booksApi.uploadFile(book.id, selectedFile)
      setUploadProgress(50)

      // Step 3: Process file
      setUploadStep('processing')
      const processResponse = await booksApi.processFile(book.id, {
        maxSegmentLength: 2000,
        minSegmentLength: 50,
        preserveFormatting: true
      })
      setUploadProgress(100)

      // Success
      setUploadStep('success')

      // Call success callback - let parent component handle the book addition
      if (onSuccess) {
        onSuccess(processResponse.data)
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
    setUploading(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">上传新书</h2>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={uploadStep !== 'form'}
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
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                书籍标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入书籍标题"
                disabled={uploadStep !== 'form'}
                required
              />
            </div>

            <div>
              <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-2">
                作者
              </label>
              <input
                type="text"
                id="author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入作者名称（可选）"
                disabled={uploadStep !== 'form'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择文件 <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
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
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">
                    点击选择文件或拖拽文件到此处
                  </p>
                  <p className="text-sm text-gray-500">
                    支持 .txt 和 .md 格式，文件大小不超过 20MB
                  </p>
                </label>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">{selectedFile.name}</p>
                    <p className="text-xs text-blue-700">
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
            <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-md">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
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
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 mx-auto text-blue-600 mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">正在上传文件...</h3>
          <div className="w-full max-w-sm mx-auto">
            <div className="bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">{uploadProgress}%</p>
          </div>
        </div>
      )}

      {/* Processing Step */}
      {uploadStep === 'processing' && (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 mx-auto text-purple-600 mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">正在处理文件内容...</h3>
          <p className="text-gray-600">正在分析文本并分段，请稍候</p>
        </div>
      )}

      {/* Success Step */}
      {uploadStep === 'success' && (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">上传成功！</h3>
          <p className="text-gray-600">书籍已成功上传并处理完成</p>
        </div>
      )}

      {/* Error Step */}
      {uploadStep === 'error' && (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto text-red-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">上传失败</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex justify-center space-x-3">
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