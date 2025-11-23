import { useState, useEffect, useCallback } from 'react'
import type { CharacterProfileSummary } from '@/types/book'
import { toast } from 'sonner'

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
    async (page = 1, search = '') => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit || initialLimit)
        })
        if (search) params.set('search', search)

        const [bookRes, charsRes] = await Promise.all([
          fetch(`/api/books/${bookId}`),
          fetch(`/api/books/${bookId}/characters?${params.toString()}`)
        ])

        if (!bookRes.ok) throw new Error('加载书籍失败')
        if (!charsRes.ok) throw new Error('加载角色失败')

        const bookData = await bookRes.json()
        const charsData = await charsRes.json()

        setBook(bookData.data)
        setCharacters(charsData.data?.data || [])
        if (charsData.data?.pagination) {
          setPagination(charsData.data.pagination)
        }
      } catch (err) {
        console.error('Failed to load characters:', err)
        setError(err instanceof Error ? err.message : '加载角色配置失败')
        toast.error(err instanceof Error ? err.message : '加载角色配置失败')
      } finally {
        setLoading(false)
      }
    },
    [bookId, pagination.limit, initialLimit]
  )

  useEffect(() => {
    load(1, '')
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

