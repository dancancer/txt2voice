'use client'

import {
  Users,
  ArrowLeft,
  Plus,
  Search,
  FileText,
  Loader2,
  CheckCircle,
  User,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";

// layout 默认导出用于 Next.js 路由包装，保持页面可渲染
export default function CharactersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function CharactersHeader({
  bookId,
  title,
  total,
  totalPages,
  onBack,
  onAdd,
  disableAdd,
}: {
  bookId: string;
  title: string;
  total: number;
  totalPages: number;
  onBack: () => void;
  onAdd: () => void;
  disableAdd?: boolean;
}) {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={onBack} className="mr-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">角色配置</h1>
              <p className="text-sm text-gray-500">{title}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">
              {total} 个角色（共 {totalPages || 1} 页）
            </Badge>
            <Button onClick={onAdd} disabled={disableAdd}>
              <Plus className="w-4 h-4 mr-2" />
              添加角色
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchInfoBar({
  search,
  onSearch,
  charactersCount,
  pagination,
  segmentsCount,
}: {
  search: string;
  onSearch: (v: string) => void;
  charactersCount: number;
  pagination: { total: number };
  segmentsCount: number;
}) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="搜索角色名称或描述..."
                className="pl-10 pr-4"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                <span>
                  当前页 {charactersCount} 个角色，总计 {pagination.total} 个
                </span>
              </div>
              {segmentsCount > 0 && (
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  <span>{segmentsCount} 个文本段落</span>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">
              按提及次数、引用次数、对话次数降序排列
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AcquisitionCards({
  hasTextSegments,
  segmentsCount,
  hasScripts,
  scriptsCount,
  lastExtractionSummary,
  onAddCharacter,
  onExtractFromScript,
  onOpenScript,
  actionLoading,
}: {
  hasTextSegments: boolean;
  segmentsCount: number;
  hasScripts: boolean;
  scriptsCount: number;
  lastExtractionSummary?: string | null;
  onAddCharacter: () => void;
  onExtractFromScript: () => void;
  onOpenScript: () => void;
  actionLoading: { scriptExtraction: boolean };
}) {

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle>角色获取方式</CardTitle>
        <p className="text-sm text-gray-500">
          可手动维护角色，也可以从台本抽取或在生成台本时自动识别。
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4 bg-white flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900">手动添加角色</p>
                <p className="text-xs text-gray-500">自定义角色档案及别名</p>
              </div>
              <div className="p-2 rounded-full bg-blue-50 text-blue-600">
                <User className="w-4 h-4" />
              </div>
            </div>
            <div className="flex-1 text-sm text-gray-500 mb-3">
              {hasTextSegments ? `已解析 ${segmentsCount} 个文本段落` : "请先完成文本处理"}
            </div>
            <Button variant="outline" onClick={onAddCharacter} disabled={!hasTextSegments}>
              <Plus className="w-4 h-4 mr-2" />
              新建角色
            </Button>
          </div>
          <div className="rounded-lg border p-4 bg-white flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900">台本抽取</p>
                <p className="text-xs text-gray-500">读取台本说话人并生成角色</p>
              </div>
              <div className="p-2 rounded-full bg-amber-50 text-amber-600">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-sm text-gray-500 flex-1 mb-3">
              {hasScripts ? `已有 ${scriptsCount} 句台词` : "尚未生成台本"}
              {lastExtractionSummary && (
                <p className="text-xs text-amber-600 mt-2">{lastExtractionSummary}</p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={onExtractFromScript}
              disabled={!hasScripts || actionLoading.scriptExtraction}
            >
              {actionLoading.scriptExtraction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  抽取中...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  从台本抽取
                </>
              )}
            </Button>
          </div>
          <div className="rounded-lg border p-4 bg-white flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900">台本生成自动识别</p>
                <p className="text-xs text-gray-500">生成台本时同步补充角色信息</p>
              </div>
              <div className="p-2 rounded-full bg-purple-50 text-purple-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-sm text-gray-500 flex-1 mb-3">
              {hasScripts
                ? `已有 ${scriptsCount} 句台词，角色会随台本持续补充`
                : hasTextSegments
                ? "生成台本时将自动识别角色，无需单独启动"
                : "请先完成文本处理"}
            </div>
            <Button
              onClick={onOpenScript}
              disabled={!hasTextSegments}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {hasScripts ? "查看台本" : "去生成台本"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaginationBar({
  page,
  total,
  limit,
  totalPages,
  hasPrev,
  hasNext,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <Card>
      <CardContent className="pt-4 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 个角色，共 {total} 个
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(page - 1)}
              disabled={!hasPrev}
            >
              上一页
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange(pageNum)}
                  className="min-w-[32px]"
                >
                  {pageNum}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(page + 1)}
              disabled={!hasNext}
            >
              下一页
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TipsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>提示</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p>为每个角色配置不同的语音，让有声读物更加生动</p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p>支持批量生成，长文本可适当提高批次大小</p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p>生成完成后可选择自动合并章节或整书音频</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
