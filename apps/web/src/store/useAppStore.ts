import { create } from 'zustand'
import type { Book } from '@/types/book'

type BooksUpdater = Book[] | ((prev: Book[]) => Book[])

interface AppState {
  // TTS 相关状态
  text: string
  isPlaying: boolean
  volume: number
  rate: number
  voice: string

  // 书籍管理状态
  books: Book[]
  isLoading: boolean
  selectedBook: Book | null
  isUploading: boolean
  error: string | null

  // TTS Actions
  setText: (text: string) => void
  setIsPlaying: (isPlaying: boolean) => void
  setVolume: (volume: number) => void
  setRate: (rate: number) => void
  setVoice: (voice: string) => void

  // Books Actions
  setBooks: (books: BooksUpdater) => void
  setLoading: (loading: boolean) => void
  setSelectedBook: (book: Book | null) => void
  setUploading: (uploading: boolean) => void
  setError: (error: string | null) => void
  addBook: (book: Book) => void
  updateBook: (id: string, updates: Partial<Book>) => void
  removeBook: (id: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial TTS state
  text: '',
  isPlaying: false,
  volume: 1,
  rate: 1,
  voice: '',

  // Initial books state
  books: [],
  isLoading: false,
  selectedBook: null,
  isUploading: false,
  error: null,

  // TTS Actions
  setText: (text) => set({ text }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setRate: (rate) => set({ rate }),
  setVoice: (voice) => set({ voice }),

  // Books Actions
  setBooks: (books) => set((state) => ({
    books: typeof books === 'function'
      ? (books as (prev: Book[]) => Book[])(state.books)
      : books
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setSelectedBook: (selectedBook) => set({ selectedBook }),
  setUploading: (isUploading) => set({ isUploading }),
  setError: (error) => set({ error }),

  addBook: (book) => set((state) => ({
    books: [book, ...state.books]
  })),

  updateBook: (id, updates) => set((state) => ({
    books: state.books.map(book =>
      book.id === id ? { ...book, ...updates } : book
    )
  })),

  removeBook: (id) => set((state) => ({
    books: state.books.filter(book => book.id !== id),
    selectedBook: state.selectedBook?.id === id ? null : state.selectedBook
  }))
}))
