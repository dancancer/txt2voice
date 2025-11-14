"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { booksApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  FileText,
  Clock,
  Search,
  Download,
  Edit,
  Loader2,
} from "lucide-react";

export default function TextSegmentsPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [segments, setSegments] = useState<any[]>([]);
  const [expandedSegments, setExpandedSegments] = useState<
    Record<string, boolean>
  >({});
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  type LoadOptions = {
    showFullPageLoader?: boolean;
  };

  const loadBookAndSegments = useCallback(
    async (
      page: number = 1,
      search: string = "",
      options: LoadOptions = {}
    ) => {
      const { showFullPageLoader = false } = options;
      try {
        if (showFullPageLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        setError(null);

        const limit = pagination.limit || 20;
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (search) {
          params.append("search", search);
        }

        // 并行加载书籍信息和段落列表
        const [bookResponse, segmentsResponse] = await Promise.all([
          booksApi.getBook(bookId),
          fetch(`/api/books/${bookId}/segments?${params}`),
        ]);

        if (!segmentsResponse.ok) {
          throw new Error("Failed to load segments");
        }

        const segmentsData = await segmentsResponse.json();

        setBook(bookResponse.data);
        const fetchedSegments = segmentsData.data?.data || [];
        setSegments(fetchedSegments);
        setExpandedSegments({});
        if (segmentsData.data?.pagination) {
          setPagination(segmentsData.data.pagination);
        } else {
          setPagination((prev) => ({
            ...prev,
            page,
            total: segmentsData.data?.data?.length || 0,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          }));
        }
      } catch (err) {
        console.error("Failed to load book and segments:", err);
        setError("加载文本段落失败");
      } finally {
        if (showFullPageLoader) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [bookId, pagination.limit]
  );

  useEffect(() => {
    let isMounted = true;
    setSearchTerm("");
    setHasLoadedInitialData(false);
    const initialize = async () => {
      await loadBookAndSegments(1, "", { showFullPageLoader: true });
      if (isMounted) {
        setHasLoadedInitialData(true);
      }
    };

    initialize();
    return () => {
      isMounted = false;
    };
  }, [bookId, loadBookAndSegments]);

  useEffect(() => {
    if (!hasLoadedInitialData) {
      return;
    }
    const timeoutId = setTimeout(() => {
      loadBookAndSegments(1, searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, hasLoadedInitialData, loadBookAndSegments]);

  const handlePageChange = (newPage: number) => {
    if (
      newPage < 1 ||
      (pagination.totalPages && newPage > pagination.totalPages)
    ) {
      return;
    }
    loadBookAndSegments(newPage, searchTerm);
  };

  const toggleSegmentExpansion = (segmentId: string) => {
    setExpandedSegments((prev) => ({
      ...prev,
      [segmentId]: !prev[segmentId],
    }));
  };

  const SEGMENT_PREVIEW_THRESHOLD = 120;

  const getSegmentTypeColor = (type: string) => {
    switch (type) {
      case "dialogue":
        return "bg-blue-100 text-blue-800";
      case "narration":
        return "bg-green-100 text-green-800";
      case "description":
        return "bg-purple-100 text-purple-800";
      case "action":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSegmentTypeText = (type: string) => {
    switch (type) {
      case "dialogue":
        return "对话";
      case "narration":
        return "旁白";
      case "description":
        return "描述";
      case "action":
        return "动作";
      default:
        return type || "普通";
    }
  };

  if (loading && !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "书籍不存在"}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/books/${bookId}`)}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  文本段落
                </h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                共 {pagination.total} 个段落（{pagination.totalPages || 1} 页）
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/books/${bookId}/audio`)}
              >
                生成音频
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="搜索段落内容..."
                className="pl-10 pr-4"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>当前页 {segments.length} 个段落</span>
            <span>总计 {pagination.total} 个</span>
            {searchTerm && <span>匹配 {pagination.total} 个结果</span>}
          </div>
        </div>

        {refreshing && (
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在更新段落...
          </div>
        )}

        {/* Segments List */}
        <div className="space-y-4">
          {segments.map((segment) => {
            const isExpanded = !!expandedSegments[segment.id];
            const shouldShowToggle =
              segment.content.length > SEGMENT_PREVIEW_THRESHOLD ||
              segment.content.includes("\n");

            return (
              <Card
                key={segment.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">
                        段落 #
                        {segment.orderIndex !== undefined
                          ? segment.orderIndex + 1
                          : segment.segmentIndex + 1}
                      </span>
                      <Badge
                        className={getSegmentTypeColor(segment.segmentType)}
                      >
                        {getSegmentTypeText(segment.segmentType)}
                      </Badge>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {segment.wordCount ||
                          Math.ceil(segment.content.length / 2)}{" "}
                        字
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(segment.content);
                          // TODO: Show success message
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // TODO: Edit segment functionality
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none">
                    <p
                      className={`text-gray-700 leading-relaxed ${
                        isExpanded ? "whitespace-pre-wrap" : "truncate"
                      }`}
                    >
                      {segment.content}
                    </p>
                    {shouldShowToggle && (
                      <div className="mt-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0"
                          onClick={() => toggleSegmentExpansion(segment.id)}
                        >
                          {isExpanded ? "收起" : "展开更多"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Segment metadata */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span>
                          位置: {segment.startPosition}-{segment.endPosition}
                        </span>
                        <span>索引: {segment.segmentIndex}</span>
                        {segment.orderIndex && (
                          <span>顺序: {segment.orderIndex}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span>状态:</span>
                        <Badge
                          variant={
                            segment.status === "processed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {segment.status === "processed" ? "已处理" : "待处理"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev}
              >
                上一页
              </Button>
              <span className="text-sm text-gray-600">
                第 {pagination.page} 页，共 {pagination.totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {segments.length === 0 && !loading && (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? "没有找到匹配的段落" : "暂无文本段落"}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? "请尝试其他搜索关键词"
                  : "这本书还没有处理文本段落，请先处理书籍文件"}
              </p>
              {!searchTerm && (
                <Button onClick={() => router.push(`/books/${bookId}`)}>
                  返回书籍详情
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
