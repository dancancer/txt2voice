// 一旦我被更新，请更新我的开头注释
// input: props/hooks/组件依赖
// output: 复用 UI
// pos: 共享组件
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book } from '@/types/book'
import { useAppStore } from '@/store/useAppStore'
import { booksApi } from '@/lib/api'
import { BookCard } from './BookCard'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Loader2,
  BookOpen,
  Filter,
  FilterX,
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
  const initialLoadRef = useRef(false)

  // Load books; reset option replaces existing list
  const loadBooks = useCallback(async (pageToLoad: number, reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const response = await booksApi.getBooks(pageToLoad, 10)
      const newBooks = response.data

      setBooks(prev => reset ? newBooks : [...prev, ...newBooks])
      setPage(pageToLoad)
      setHasMore(newBooks.length === 10)

    } catch (err) {
      setError(err instanceof Error ? err.message : '加载书籍列表失败')
    } finally {
      setLoading(false)
    }
  }, [setBooks, setError, setLoading])

  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    loadBooks(1, true) // Always reset and reload when component mounts
  }, [loadBooks])

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
  const completedBooksCount = books.filter(
    (book) =>
      book.status === 'completed' ||
      book.status === 'completed_with_errors' ||
      book.status === 'audio_review_ready'
  ).length
  const hasActiveFilters =
    Boolean(searchQuery) || statusFilter !== 'all' || sortBy !== 'createdAt' || sortOrder !== 'desc'
  const selectClassName =
    "flex h-11 w-full rounded-xl border border-input bg-background/90 px-3 py-2 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"

  const handleRefresh = () => {
    loadBooks(1, true)
  }

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1
      loadBooks(nextPage)
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

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSortBy('createdAt')
    setSortOrder('desc')
  }

  if (error) {
    return (
      <div className="rounded-[1.35rem] border border-destructive/15 bg-destructive/5 px-4 py-12 text-center">
        <div className="mb-4 text-destructive">
          <Filter className="w-12 h-12 mx-auto mb-2" />
          <p className="text-center">{error}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
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
      <div className="rounded-[1.35rem] border border-dashed border-border bg-muted/35 px-4 py-12 text-center">
        <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium text-foreground">还没有书籍</h3>
        <p className="mb-6 text-center text-muted-foreground">
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">我的书籍</h2>
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              共 {books.length} 本
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              已完成 {completedBooksCount} 本
            </span>
            {hasActiveFilters ? (
              <span className="inline-flex items-center rounded-full border border-border bg-accent/70 px-3 py-1 text-xs font-medium text-accent-foreground">
                当前筛选 {filteredBooks.length} 本
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            按书名、作者或文件名快速检索，并按状态与时间筛选待处理任务。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {hasActiveFilters ? (
            <Button onClick={clearFilters} variant="outline">
              <FilterX className="w-4 h-4 mr-2" />
              清除筛选
            </Button>
          ) : null}
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
      <div className="grid gap-4 rounded-[1.35rem] border border-border/80 bg-muted/30 p-4 lg:grid-cols-[minmax(0,1.7fr)_220px_220px] lg:items-end">
        {/* Search */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="book-search">搜索</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              id="book-search"
              type="text"
              placeholder="搜索书名、作者或文件名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            支持按书名、作者或原始文件名模糊搜索。
          </p>
        </div>

        {/* Status Filter */}
        <div className="space-y-2 lg:w-[220px]">
          <Label htmlFor="book-status-filter">状态</Label>
          <select
            id="book-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClassName}
          >
            <option value="all">所有状态</option>
            <option value="uploaded">已上传</option>
            <option value="processing">处理中</option>
            <option value="processed">已处理</option>
            <option value="script_generated">脚本已生成</option>
            <option value="generating_audio">生成音频中</option>
            <option value="audio_review_ready">音频待验收</option>
            <option value="completed_with_errors">部分完成</option>
            <option value="completed">已完成</option>
          </select>
        </div>

        {/* Sort */}
        <div className="space-y-2 lg:w-[220px]">
          <Label htmlFor="book-sort-order">排序</Label>
          <select
            id="book-sort-order"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-')
              setSortBy(field as 'createdAt' | 'title' | 'status')
              setSortOrder(order as 'asc' | 'desc')
            }}
            className={selectClassName}
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="rounded-[1.35rem] border border-dashed border-border bg-muted/30 py-10 text-center">
          <Filter className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">没有找到匹配的书籍</h3>
          <p className="mb-4 text-muted-foreground">
            尝试调整搜索条件或筛选器
          </p>
          <Button onClick={clearFilters} variant="outline">
            清除筛选条件
          </Button>
        </div>
      )}
    </div>
  )
}
