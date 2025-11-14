'use client'

import { useEffect, useState } from 'react'
import { Book } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'
import { booksApi } from '@/lib/api'
import { BookCard } from './BookCard'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Loader2,
  BookOpen,
  Filter,
  Search,
  RefreshCw,
  Plus
} from 'lucide-react'

interface BookListProps {
  onBookSelect?: (book: Book) => void
  onBookDelete?: (id: string) => void
  onBookUpdate?: (book: Book) => void
  showUploadButton?: boolean
  onUploadClick?: () => void
}

export function BookList({
  onBookSelect,
  onBookDelete,
  onBookUpdate,
  showUploadButton = true,
  onUploadClick
}: BookListProps) {
  const {
    books,
    isLoading,
    error,
    setBooks,
    setLoading,
    setError,
    updateBook,
    removeBook
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'createdAt' | 'title' | 'status'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Load books on mount and when component re-renders with new key
  useEffect(() => {
    loadBooks(true) // Always reset and reload when component mounts
  }, [])

  // Load books from API
  const loadBooks = async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      if (reset) {
        setPage(1)
        setBooks([])
      }

      const response = await booksApi.getBooks(reset ? 1 : page, 10)
      const newBooks = response.data

      if (reset) {
        setBooks(newBooks)
      } else {
        setBooks([...books, ...newBooks])
      }

      setHasMore(newBooks.length === 10)

    } catch (err) {
      setError(err instanceof Error ? err.message : '加载书籍列表失败')
    } finally {
      setLoading(false)
    }
  }

  // Handle book deletion
  const handleBookDelete = (id: string) => {
    removeBook(id)
    if (onBookDelete) {
      onBookDelete(id)
    }
  }

  // Handle book update
  const handleBookUpdate = (updatedBook: Book) => {
    updateBook(updatedBook.id, updatedBook)
    if (onBookUpdate) {
      onBookUpdate(updatedBook)
    }
  }

  // Filter and sort books
  const filteredBooks = books
    .filter(book => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          book.title.toLowerCase().includes(query) ||
          (book.author && book.author.toLowerCase().includes(query)) ||
          (book.originalFilename && book.originalFilename.toLowerCase().includes(query))
        )
      }
      return true
    })
    .filter(book => {
      // Status filter
      if (statusFilter !== 'all') {
        return book.status === statusFilter
      }
      return true
    })
    .sort((a, b) => {
      // Sort
      let comparison = 0
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const handleRefresh = () => {
    loadBooks(true)
  }

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setPage(prev => prev + 1)
      loadBooks()
    }
  }

  const toggleSort = (field: 'createdAt' | 'title' | 'status') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-red-600 mb-4">
          <Filter className="w-12 h-12 mx-auto mb-2" />
          <p className="text-center">{error}</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
          {showUploadButton && onUploadClick && (
            <Button onClick={onUploadClick}>
              <Plus className="w-4 h-4 mr-2" />
              上传新书
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (books.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <BookOpen className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">还没有书籍</h3>
        <p className="text-gray-600 text-center mb-6">
          上传您的第一本书开始使用文本转语音功能
        </p>
        {showUploadButton && onUploadClick && (
          <Button onClick={onUploadClick} size="lg">
            <Plus className="w-5 h-5 mr-2" />
            上传第一本书
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">我的书籍</h2>
          <p className="text-gray-600 mt-1">
            共 {filteredBooks.length} 本书，{books.filter(b => b.status === 'completed').length} 本已完成
          </p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {showUploadButton && onUploadClick && (
            <Button onClick={onUploadClick}>
              <Plus className="w-4 h-4 mr-2" />
              上传新书
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="搜索书名、作者或文件名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="lg:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">所有状态</option>
            <option value="uploaded">已上传</option>
            <option value="processing">处理中</option>
            <option value="processed">已处理</option>
            <option value="script_generated">脚本已生成</option>
            <option value="generating_audio">生成音频中</option>
            <option value="completed">已完成</option>
          </select>
        </div>

        {/* Sort */}
        <div className="lg:w-48">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-')
              setSortBy(field as 'createdAt' | 'title' | 'status')
              setSortOrder(order as 'asc' | 'desc')
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt-desc">最新创建</option>
            <option value="createdAt-asc">最早创建</option>
            <option value="title-asc">标题 A-Z</option>
            <option value="title-desc">标题 Z-A</option>
            <option value="status-asc">状态排序</option>
          </select>
        </div>
      </div>

      {/* Books Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBooks.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onDelete={handleBookDelete}
            onUpdate={handleBookUpdate}
          />
        ))}
      </div>

      {/* Loading More */}
      {hasMore && (
        <div className="flex justify-center py-6">
          <Button
            onClick={handleLoadMore}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                加载中...
              </>
            ) : (
              '加载更多'
            )}
          </Button>
        </div>
      )}

      {/* No Results */}
      {filteredBooks.length === 0 && books.length > 0 && (
        <div className="text-center py-8">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">没有找到匹配的书籍</h3>
          <p className="text-gray-600 mb-4">
            尝试调整搜索条件或筛选器
          </p>
          <Button onClick={() => { setSearchQuery(''); setStatusFilter('all') }} variant="outline">
            清除筛选条件
          </Button>
        </div>
      )}
    </div>
  )
}
