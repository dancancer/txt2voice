// 一旦我被更新，请更新我的开头注释
// input: hook 参数/外部依赖
// output: 状态/动作
// pos: 复用 Hook
import { useState, useEffect, useCallback } from 'react'
import type { CharacterProfileSummary } from '@/types/book'
import { toast } from 'sonner'
import {
  isFetchInterruptedError,
  isRequestCanceled,
} from '@/lib/request-guards'

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function useBookCharacters(bookId: string, initialLimit = 20) {
  const [book, setBook] = useState<any>(null)
  const [characters, setCharacters] = useState<CharacterProfileSummary[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: initialLimit,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (page = 1, search = '', signal?: AbortSignal) => {
      try {
        if (signal?.aborted) {
          return
        }
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit || initialLimit)
        })
        if (search) params.set('search', search)

        const [bookRes, charsRes] = await Promise.all([
          fetch(`/api/books/${bookId}`, { signal }),
          fetch(`/api/books/${bookId}/characters?${params.toString()}`, { signal })
        ])

        if (!bookRes.ok) throw new Error('加载书籍失败')
        if (!charsRes.ok) throw new Error('加载角色失败')

        const bookData = await bookRes.json()
        const charsData = await charsRes.json()
        if (signal?.aborted) {
          return
        }

        setBook(bookData.data)
        setCharacters(charsData.data?.data || [])
        if (charsData.data?.pagination) {
          setPagination(charsData.data.pagination)
        }
      } catch (err) {
        if (isRequestCanceled(err, signal) || isFetchInterruptedError(err)) {
          return
        }
        console.error('Failed to load characters:', err)
        setError(err instanceof Error ? err.message : '加载角色配置失败')
        toast.error(err instanceof Error ? err.message : '加载角色配置失败')
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [bookId, pagination.limit, initialLimit]
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(1, '', controller.signal)
    return () => controller.abort()
  }, [load])

  return {
    book,
    characters,
    pagination,
    loading,
    searchTerm,
    setSearchTerm,
    reload: (page?: number, search?: string) => load(page ?? pagination.page, search ?? searchTerm),
    setPagination,
    setCharacters,
    error
  }
}
