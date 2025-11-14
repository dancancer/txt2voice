'use client'

import { useParams } from 'next/navigation'
import { BookNavigation } from '@/components/BookNavigation'

export default function BookLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const bookId = params.id as string

  return (
    <div className="min-h-full bg-gray-50">
      <BookNavigation bookId={bookId} />
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}
