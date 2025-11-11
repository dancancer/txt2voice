'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Users,
  Play,
  Settings,
  List,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BookNavigationProps {
  bookId: string
  bookTitle?: string
  currentTab?: string
}

const bookTabs = [
  {
    id: 'overview',
    name: '概览',
    href: '',
    icon: List,
  },
  {
    id: 'segments',
    name: '文本段落',
    href: '/segments',
    icon: FileText,
  },
  {
    id: 'characters',
    name: '角色配置',
    href: '/characters',
    icon: Users,
  },
  {
    id: 'script',
    name: '台本生成',
    href: '/script',
    icon: FileText,
  },
  {
    id: 'audio',
    name: '音频生成',
    href: '/audio',
    icon: Play,
  },
  {
    id: 'play',
    name: '播放',
    href: '/play',
    icon: Play,
  },
]

export function BookNavigation({ bookId, bookTitle, currentTab }: BookNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  // 自动检测当前标签页
  const activeTab = currentTab || bookTabs.find(tab => 
    pathname.endsWith(tab.href) || (tab.href === '' && pathname === `/books/${bookId}`)
  )?.id || 'overview'

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        {/* 顶部面包屑和返回按钮 */}
        <div className="flex items-center justify-between py-4 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回书籍列表
            </Button>
            {bookTitle && (
              <>
                <span className="text-gray-400">/</span>
                <h2 className="text-lg font-semibold text-gray-900">{bookTitle}</h2>
              </>
            )}
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="flex space-x-1 overflow-x-auto">
          {bookTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const href = `/books/${bookId}${tab.href}`

            return (
              <button
                key={tab.id}
                onClick={() => router.push(href)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
