import type { BookStatus } from '@/types/book'
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  Play,
  Sparkles,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react'

export type BookStatusMeta = {
  label: string
  className: string
  icon: LucideIcon
  animated?: boolean
}

const DEFAULT_META: BookStatusMeta = {
  label: '未知状态',
  className: 'bg-gray-100 text-gray-800',
  icon: AlertCircle,
}

const STATUS_META: Record<BookStatus, BookStatusMeta> = {
  uploading: {
    label: '上传中',
    className: 'bg-slate-100 text-slate-800',
    icon: Loader2,
    animated: true,
  },
  uploaded: {
    label: '已上传',
    className: 'bg-gray-100 text-gray-800',
    icon: FileText,
  },
  processing: {
    label: '处理中',
    className: 'bg-blue-100 text-blue-800',
    icon: Loader2,
    animated: true,
  },
  processed: {
    label: '已处理',
    className: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  analyzing: {
    label: '角色分析中',
    className: 'bg-indigo-100 text-indigo-800',
    icon: Users,
    animated: true,
  },
  analyzed: {
    label: '角色分析完成',
    className: 'bg-teal-100 text-teal-800',
    icon: Users,
  },
  generating_script: {
    label: '生成台本中',
    className: 'bg-orange-100 text-orange-800',
    icon: Loader2,
    animated: true,
  },
  script_generated: {
    label: '台本已生成',
    className: 'bg-purple-100 text-purple-800',
    icon: Sparkles,
  },
  generating_audio: {
    label: '生成音频中',
    className: 'bg-orange-100 text-orange-800',
    icon: Loader2,
    animated: true,
  },
  completed: {
    label: '已完成',
    className: 'bg-emerald-100 text-emerald-800',
    icon: Play,
  },
  error: {
    label: '出错',
    className: 'bg-red-100 text-red-800',
    icon: AlertCircle,
  },
}

export const getBookStatusMeta = (status: BookStatus): BookStatusMeta =>
  STATUS_META[status] || DEFAULT_META

export const getStatusColor = (status: BookStatus): string =>
  getBookStatusMeta(status).className

export const getStatusText = (status: BookStatus): string =>
  getBookStatusMeta(status).label

