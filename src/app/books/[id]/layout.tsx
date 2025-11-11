'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BookNavigation } from '@/components/BookNavigation'
import { booksApi } from '@/lib/api'

export default function BookLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const bookId = params.id as string
  const [bookTitle, setBookTitle] = useState<string>()

  useEffect(() => {
    // 加载书籍标题用于导航显示
    booksApi.getBook(bookId)
      .then(response => setBookTitle(response.data.title))
      .catch(() => setBookTitle('书籍详情'))
  }, [bookId])

  return (
    <div className="min-h-full bg-gray-50">
      <BookNavigation bookId={bookId} bookTitle={bookTitle} />
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}
