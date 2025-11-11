'use client'

import { useState, useRef } from 'react'
import { BookList } from '@/components/BookList'
import { BookUpload } from '@/components/BookUpload'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Plus,
  X,
  Sparkles,
  Mic,
  FileText,
  Users
} from 'lucide-react'

export default function Home() {
  const [showUpload, setShowUpload] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleUploadSuccess = (book: any) => {
    // Close upload dialog and trigger BookList refresh
    setShowUpload(false)
    // Increment refresh key to force BookList to reload
    setRefreshKey(prev => prev + 1)
  }

  const handleUploadCancel = () => {
    setShowUpload(false)
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 min-h-full">

      {/* Hero Section - Only show when no books and not uploading */}
      {!showUpload && (
        <section className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              将文字转化为自然流畅的语音
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              支持多种语音风格和情感表达，为您的文本内容带来生动的声音体验。
              上传书籍文件，智能分析角色，一键生成完整的有声内容。
            </p>
            <Button
              onClick={() => setShowUpload(true)}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              开始上传第一本书
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">智能文本处理</h3>
              <p className="text-gray-600">
                自动识别文本格式，智能分段，支持多种文件格式和编码
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">角色智能分析</h3>
              <p className="text-gray-600">
                AI 自动识别文本中的角色，为不同角色分配合适的语音
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">高质量语音合成</h3>
              <p className="text-gray-600">
                集成多种 TTS 服务，支持情感表达和语音参数调整
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <section className="container mx-auto px-4 pb-12">
        {showUpload ? (
          <div className="max-w-4xl mx-auto">
            {/* Upload Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">上传新书籍</h2>
              <Button
                variant="ghost"
                onClick={handleUploadCancel}
                disabled={false}
              >
                <X className="w-4 h-4 mr-2" />
                返回列表
              </Button>
            </div>

            {/* Upload Component */}
            <BookUpload
              onSuccess={handleUploadSuccess}
              onCancel={handleUploadCancel}
            />
          </div>
        ) : (
          <div>
            {/* Books List Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">我的书籍</h2>
                <Button
                  onClick={() => setShowUpload(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  上传新书
                </Button>
              </div>
              <p className="text-gray-600">
                管理您的书籍，查看处理进度，开始语音合成
              </p>
            </div>

            {/* Books List */}
            <BookList
              key={refreshKey} // Force re-render when refreshKey changes
              onBookSelect={(book) => {
                // Handle book selection - navigate to book details
                console.log('Selected book:', book)
              }}
              onBookDelete={(id) => {
                console.log('Deleted book:', id)
              }}
              onBookUpdate={(book) => {
                console.log('Updated book:', book)
              }}
              showUploadButton={false} // Hide upload button since we have it in header
              onUploadClick={() => setShowUpload(true)}
            />
          </div>
        )}
      </section>

    </div>
  )
}