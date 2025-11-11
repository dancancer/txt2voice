'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { booksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  FileText,
  User,
  Clock,
  Search,
  Download,
  Edit
} from 'lucide-react'

export default function TextSegmentsPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.id as string

  const [book, setBook] = useState<any>(null)
  const [segments, setSegments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [segmentsPerPage] = useState(20)

  useEffect(() => {
    loadBookAndSegments()
  }, [bookId])

  const loadBookAndSegments = async () => {
    try {
      setLoading(true)
      const response = await booksApi.getBook(bookId)
      setBook(response.data)
      setSegments(response.data.textSegments || [])
    } catch (err) {
      console.error('Failed to load book and segments:', err)
      setError('加载文本段落失败')
    } finally {
      setLoading(false)
    }
  }

  const filteredSegments = segments.filter(segment =>
    segment.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const indexOfLastSegment = currentPage * segmentsPerPage
  const indexOfFirstSegment = indexOfLastSegment - segmentsPerPage
  const currentSegments = filteredSegments.slice(indexOfFirstSegment, indexOfLastSegment)
  const totalPages = Math.ceil(filteredSegments.length / segmentsPerPage)

  const getSegmentTypeColor = (type: string) => {
    switch (type) {
      case 'dialogue':
        return 'bg-blue-100 text-blue-800'
      case 'narration':
        return 'bg-green-100 text-green-800'
      case 'description':
        return 'bg-purple-100 text-purple-800'
      case 'action':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSegmentTypeText = (type: string) => {
    switch (type) {
      case 'dialogue':
        return '对话'
      case 'narration':
        return '旁白'
      case 'description':
        return '描述'
      case 'action':
        return '动作'
      default:
        return type || '普通'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || '书籍不存在'}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/books/${bookId}`)}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">文本段落</h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                {filteredSegments.length} 个段落
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/books/${bookId}/audio`)}
              >
                生成音频
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜索段落内容..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                <span>共 {segments.length} 个段落</span>
                {searchTerm && (
                  <span>找到 {filteredSegments.length} 个匹配</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Segments List */}
        <div className="space-y-4">
          {currentSegments.map((segment, index) => (
            <Card key={segment.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500">
                      段落 #{segment.orderIndex !== undefined ? segment.orderIndex + 1 : segment.segmentIndex + 1}
                    </span>
                    <Badge className={getSegmentTypeColor(segment.segmentType)}>
                      {getSegmentTypeText(segment.segmentType)}
                    </Badge>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {segment.wordCount || Math.ceil(segment.content.length / 2)} 字
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(segment.content)
                        // TODO: Show success message
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // TODO: Edit segment functionality
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {segment.content}
                  </p>
                </div>

                {/* Segment metadata */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>位置: {segment.startPosition}-{segment.endPosition}</span>
                      <span>索引: {segment.segmentIndex}</span>
                      {segment.orderIndex && (
                        <span>顺序: {segment.orderIndex}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span>状态:</span>
                      <Badge variant={segment.status === 'processed' ? 'default' : 'secondary'}>
                        {segment.status === 'processed' ? '已处理' : '待处理'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <span className="text-sm text-gray-600">
                第 {currentPage} 页，共 {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {currentSegments.length === 0 && !loading && (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? '没有找到匹配的段落' : '暂无文本段落'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? '请尝试其他搜索关键词'
                  : '这本书还没有处理文本段落，请先处理书籍文件'
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => router.push(`/books/${bookId}`)}>
                  返回书籍详情
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}