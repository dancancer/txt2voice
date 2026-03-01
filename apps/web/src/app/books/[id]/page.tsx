// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { booksApi } from '@/lib/api'
import { getBookStatusMeta } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  BookOpen,
  FileText,
  Users,
  Play,
  Settings,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const statusMeta = getBookStatusMeta(book.status)
  const statusIconClass = statusMeta.animated ? 'w-4 h-4 animate-spin' : 'w-4 h-4'
  const counts = {
    segments: book?.counts?.segments ?? book?.totalSegments ?? 0,
    characters: book?.counts?.characters ?? 0,
    scripts: book?.counts?.scripts ?? 0,
    audioFiles: book?.counts?.audioFiles ?? 0
  }
  const latestTask = book.latestTask || book.processingTasks?.[0]
  const canGoScript = book.status === 'processed' || counts.scripts > 0
  const canGoAudio = counts.scripts > 0
  const canGoPlay = counts.audioFiles > 0

  return (
    <div className="max-w-7xl mx-auto">
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
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-2 ${statusMeta.className}`}>
                    <statusMeta.icon className={`${statusIconClass} mr-1`} />
                    <span>{statusMeta.label}</span>
                  </div>
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
                    <span>段落：{counts.segments}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span>角色：{counts.characters}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Play className="w-4 h-4 mr-2" />
                    <span>音频：{counts.audioFiles}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="w-4 h-4 mr-2 text-center">字</span>
                    <span>字符：{book.totalCharacters?.toLocaleString() || 0}</span>
                  </div>
                </div>

                {/* Progress */}
                {book.status !== 'uploaded' && latestTask && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>处理进度</span>
                      <span>
                        {latestTask.progress || 0}%
                      </span>
                    </div>
                    <Progress value={latestTask.progress || 0} />
                    {latestTask.message && (
                      <p className="text-xs text-gray-500 mt-1">
                        {latestTask.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  {canGoScript && (
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={() => router.push(`/books/${bookId}/script`)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      台本与角色
                    </Button>
                  )}
                  {canGoPlay && (
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
                    流程总览
                  </h3>
                  <p className="text-gray-600 mb-6">
                    上传文本后，依次完成台本生成、角色配音与音频合成。
                  </p>

                  {/* Task Status Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className={`p-4 rounded-lg border ${
                      counts.segments > 0
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <FileText className="w-6 h-6 mx-auto mb-2 text-green-600" />
                      <h4 className="font-medium mb-1">文本处理</h4>
                      <p className="text-sm text-gray-600">
                        {counts.segments} 个段落
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      counts.characters > 0
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <Users className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
                      <h4 className="font-medium mb-1">角色识别</h4>
                      <p className="text-sm text-gray-600">
                        {counts.characters > 0 ? `${counts.characters} 个角色` : '随台本生成'}
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      counts.scripts > 0
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <FileText className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                      <h4 className="font-medium mb-1">台本生成</h4>
                      <p className="text-sm text-gray-600">
                        {counts.scripts} 句台词
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      counts.characters > 0
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <Settings className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                      <h4 className="font-medium mb-1">角色管理</h4>
                      <p className="text-sm text-gray-600">
                        {counts.characters} 个角色
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${
                      counts.audioFiles > 0
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <Play className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                      <h4 className="font-medium mb-1">音频生成</h4>
                      <p className="text-sm text-gray-600">
                        {counts.audioFiles} 个音频
                      </p>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    {counts.segments > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/script`)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        查看章节结构
                      </Button>
                    )}
                    {canGoScript && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/script`)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        生成台本
                      </Button>
                    )}
                    {counts.characters > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/characters`)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        管理角色配置
                      </Button>
                    )}
                    {canGoAudio && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/books/${bookId}/audio`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        生成音频
                      </Button>
                    )}
                    {canGoPlay && (
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
  )
}
