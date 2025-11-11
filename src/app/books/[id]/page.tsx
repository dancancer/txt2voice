'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { booksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Users,
  Play,
  Settings,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

export default function BookDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.id as string

  const [book, setBook] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadBook()
  }, [bookId])

  const loadBook = async () => {
    try {
      setLoading(true)
      const response = await booksApi.getBook(bookId)
      setBook(response.data)
    } catch (err) {
      console.error('Failed to load book:', err)
      setError('加载书籍详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleStartCharacterAnalysis = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/characters/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        // 重新加载书籍数据以更新状态
        await loadBook()
      } else {
        setError('角色分析启动失败')
      }
    } catch (err) {
      console.error('Failed to start character analysis:', err)
      setError('角色分析启动失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'processed':
        return 'bg-green-100 text-green-800'
      case 'analyzing':
        return 'bg-indigo-100 text-indigo-800'
      case 'analyzed':
        return 'bg-teal-100 text-teal-800'
      case 'script_generated':
        return 'bg-purple-100 text-purple-800'
      case 'generating_script':
        return 'bg-orange-100 text-orange-800'
      case 'generating_audio':
        return 'bg-orange-100 text-orange-800'
      case 'completed':
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploaded':
        return '已上传'
      case 'processing':
        return '处理中'
      case 'processed':
        return '已处理'
      case 'analyzing':
        return '角色分析中'
      case 'analyzed':
        return '角色分析完成'
      case 'script_generated':
        return '台本已生成'
      case 'generating_script':
        return '生成台本中'
      case 'generating_audio':
        return '生成音频中'
      case 'completed':
        return '已完成'
      default:
        return '未知状态'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <FileText className="w-4 h-4" />
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'processed':
        return <CheckCircle className="w-4 h-4" />
      case 'analyzing':
        return <Users className="w-4 h-4 animate-pulse" />
      case 'analyzed':
        return <Users className="w-4 h-4" />
      case 'script_generated':
        return <FileText className="w-4 h-4" />
      case 'generating_script':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'generating_audio':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
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
                onClick={() => router.back()}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">书籍详情</h1>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(book.status)}`}>
              {getStatusIcon(book.status)}
              <span>{getStatusText(book.status)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Book Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  书籍信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{book.title}</h3>
                  {book.author && (
                    <p className="text-sm text-gray-600 mb-1">作者：{book.author}</p>
                  )}
                  {book.originalFilename && (
                    <p className="text-xs text-gray-500 mb-1">文件：{book.originalFilename}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    创建时间：{new Date(book.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>段落：{book.textSegments?.length || 0}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span>角色：{book.characterProfiles?.length || 0}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Play className="w-4 h-4 mr-2" />
                    <span>音频：{book.audioFiles?.length || 0}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="w-4 h-4 mr-2 text-center">字</span>
                    <span>字符：{book.totalCharacters?.toLocaleString() || 0}</span>
                  </div>
                </div>

                {/* Progress */}
                {book.status !== 'completed' && book.status !== 'uploaded' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>处理进度</span>
                      <span>
                        {book.processingTasks?.[0]?.progress || 0}%
                      </span>
                    </div>
                    <Progress value={book.processingTasks?.[0]?.progress || 0} />
                    {book.processingTasks?.[0]?.message && (
                      <p className="text-xs text-gray-500 mt-1">
                        {book.processingTasks[0].message}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  {book.status === 'processed' && (
                    <>
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={() => handleStartCharacterAnalysis()}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        开始角色分析
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/books/${bookId}/script`)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        直接生成台本
                      </Button>
                    </>
                  )}
                  {book.status === 'analyzed' && (
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={() => router.push(`/books/${bookId}/script`)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      生成台本
                    </Button>
                  )}
                  {book.status === 'completed' && (
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={() => router.push(`/books/${bookId}/play`)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      播放音频
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>任务管理</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <div className="mb-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <Settings className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    任务管理功能
                  </h3>
                  <p className="text-gray-600 mb-6">
                    这里将显示书籍的详细任务管理界面，包括文本段落、角色配置、音频生成等功能。
                  </p>

                  {/* Task Status Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className={`p-4 rounded-lg border ${
                      (book.textSegments?.length || 0) > 0
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <FileText className="w-6 h-6 mx-auto mb-2 text-green-600" />
                      <h4 className="font-medium mb-1">文本处理</h4>
                      <p className="text-sm text-gray-600">
                        {book.textSegments?.length || 0} 个段落
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      book.status === 'analyzing'
                        ? 'bg-indigo-50 border-indigo-200'
                        : book.status === 'analyzed'
                        ? 'bg-teal-50 border-teal-200'
                        : (book.characterProfiles?.length || 0) > 0
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <Users className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
                      <h4 className="font-medium mb-1">角色分析</h4>
                      <p className="text-sm text-gray-600">
                        {book.status === 'analyzing'
                          ? `${book.processingTasks?.[0]?.progress || 0}%`
                          : book.status === 'analyzed'
                          ? '已完成'
                          : `${book.characterProfiles?.length || 0} 个角色`
                        }
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      (book.scriptSentences?.length || 0) > 0
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <FileText className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                      <h4 className="font-medium mb-1">台本生成</h4>
                      <p className="text-sm text-gray-600">
                        {book.scriptSentences?.length || 0} 句台词
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      (book.characterProfiles?.length || 0) > 0
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <Settings className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                      <h4 className="font-medium mb-1">角色管理</h4>
                      <p className="text-sm text-gray-600">
                        {book.characterProfiles?.length || 0} 个角色
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      (book.audioFiles?.length || 0) > 0
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <Play className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                      <h4 className="font-medium mb-1">音频生成</h4>
                      <p className="text-sm text-gray-600">
                        {book.audioFiles?.length || 0} 个音频
                      </p>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    {(book.textSegments?.length || 0) > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/segments`)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        查看文本段落
                      </Button>
                    )}
                    {(book.textSegments?.length || 0) > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/script`)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        生成台本
                      </Button>
                    )}
                    {(book.characterProfiles?.length || 0) > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/characters`)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        管理角色配置
                      </Button>
                    )}
                    {(book.scriptSentences?.length || 0) > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/audio`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        生成音频
                      </Button>
                    )}
                    {(book.audioFiles?.length || 0) > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/play`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        播放音频
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}