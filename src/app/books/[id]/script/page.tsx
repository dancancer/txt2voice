"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { booksApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  FileText,
  User,
  Zap,
  Settings,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Plus,
  Eye,
  Clock,
  Download,
  SkipForward,
} from "lucide-react";

interface ScriptSentence {
  id: string;
  text: string;
  orderInSegment: number;
  characterId?: string;
  segmentId: string;
  character?: {
    id: string;
    name: string;
  };
  segment?: {
    id: string;
    content: string;
    orderIndex: number;
  };
}

interface CharacterProfile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  aliases: Array<{ alias: string }>;
}

export default function ScriptGenerationPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [scriptSentences, setScriptSentences] = useState<ScriptSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Script generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [selectedCharacters, setSelectedCharacters] = useState<
    Record<string, string>
  >({});
  const [showCharacterAssignment, setShowCharacterAssignment] = useState(false);

  // Incremental processing state
  const [showIncrementalOptions, setShowIncrementalOptions] = useState(false);
  const [selectedStartSegment, setSelectedStartSegment] = useState<
    string | null
  >(null);
  const [segmentStatus, setSegmentStatus] = useState<any[]>([]);

  // Segment regeneration state
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentStatusLoading, setSegmentStatusLoading] = useState(false);

  // Script editing state
  const [editingSentence, setEditingSentence] = useState<ScriptSentence | null>(
    null
  );
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  const loadBookAndData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await booksApi.getBook(bookId);
      setBook(response.data);
      setSegments(response.data.textSegments || []);
      setCharacters(response.data.characterProfiles || []);
      setScriptSentences(response.data.scriptSentences || []);

      // Initialize character assignments
      const assignments: Record<string, string> = {};
      response.data.characterProfiles?.forEach((char: CharacterProfile) => {
        if (char.isActive) {
          assignments[char.id] = char.id;
        }
      });
      setSelectedCharacters(assignments);
    } catch (err) {
      console.error("Failed to load book and script data:", err);
      setError("加载台本数据失败");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadBookAndData();
  }, [bookId, loadBookAndData]);

  const generateScript = async () => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus("开始生成台本...");

      // Check if text segments exist
      if (!hasTextSegments) {
        alert("没有文本段落，请先处理文本");
        setIsGenerating(false);
        return;
      }

      // Get first two segments for initial generation
      const firstTwoSegments = segments.slice(0, 2);
      if (firstTwoSegments.length === 0) {
        alert("没有可处理的文本段落");
        setIsGenerating(false);
        return;
      }

      // Start script generation with first two segments only
      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startFromSegmentId: firstTwoSegments[0].id,
          options: {
            includeNarration: true,
            emotionDetection: true,
            contextAnalysis: true,
            minDialogueLength: 5,
            maxDialogueLength: 200,
            preserveOriginalBreaks: true,
            limitToSegments: 2, // Custom option to limit to first 2 segments
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "生成失败");
      }

      const result = await response.json();
      setGenerationStatus("台本生成任务已启动！");

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `/api/books/${bookId}/script/generate`
          );
          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            throw new Error("获取状态失败");
          }

          const statusResult = await statusResponse.json();
          const progress = statusResult.data.generationProgress || 0;
          const status = statusResult.data.scriptStatus;

          setGenerationProgress(progress);

          if (status === "completed") {
            setGenerationStatus("前两个段落台本生成完成！");
            clearInterval(pollInterval);
            await loadBookAndData();
            setIsGenerating(false);
          } else if (status === "failed") {
            setGenerationStatus("台本生成失败");
            clearInterval(pollInterval);
            setIsGenerating(false);
            alert("台本生成失败，请检查配置后重试");
          }
        } catch (error) {
          console.error("Polling error:", error);
          clearInterval(pollInterval);
          setGenerationStatus("获取状态失败");
          setIsGenerating(false);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setGenerationStatus("生成超时");
          setIsGenerating(false);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Failed to generate script:", error);
      setGenerationStatus("台本生成失败");
      alert(
        `台本生成失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
      setIsGenerating(false);
    }
  };

  const handleCharacterAssignment = async () => {
    try {
      // TODO: Implement character assignment API
      console.log("Assigning characters:", selectedCharacters);
      setShowCharacterAssignment(false);
      await loadBookAndData();
      alert("角色分配已保存");
    } catch (error) {
      console.error("Failed to assign characters:", error);
      alert("保存角色分配失败");
    }
  };

  const handleSentenceEdit = async (sentenceId: string, newText: string) => {
    try {
      // TODO: Implement sentence editing API
      console.log("Editing sentence:", sentenceId, newText);
      setEditingSentence(null);
      await loadBookAndData();
    } catch (error) {
      console.error("Failed to edit sentence:", error);
      alert("编辑句子失败");
    }
  };

  const handleSentenceDelete = async (sentenceId: string) => {
    if (confirm("确定要删除这句台词吗？")) {
      try {
        // TODO: Implement sentence deletion API
        console.log("Deleting sentence:", sentenceId);
        await loadBookAndData();
      } catch (error) {
        console.error("Failed to delete sentence:", error);
        alert("删除句子失败");
      }
    }
  };

  const regenerateScript = async () => {
    if (confirm("重新生成台本将覆盖现有内容，确定要继续吗？")) {
      await generateScript();
    }
  };

  const exportScript = async () => {
    try {
      // TODO: Implement script export
      const scriptContent = scriptSentences
        .map((sentence) => {
          const characterName = sentence.character?.name || "旁白";
          return `${characterName}: ${sentence.text}`;
        })
        .join("\n\n");

      const blob = new Blob([scriptContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${book.title}_台本.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export script:", error);
      alert("导出台本失败");
    }
  };

  // Load segment status for incremental processing
  const loadSegmentStatus = async () => {
    try {
      setSegmentStatusLoading(true);
      const response = await fetch(
        `/api/books/${bookId}/script/generate?includeSegmentStatus=true`
      );
      if (!response.ok) throw new Error("Failed to load segment status");

      const result = await response.json();
      setSegmentStatus(result.data.segments.items || []);
    } catch (error) {
      console.error("Failed to load segment status:", error);
      alert("加载段落状态失败");
    } finally {
      setSegmentStatusLoading(false);
    }
  };

  // Incremental processing from selected segment
  const handleIncrementalProcessing = async (startSegmentId: string) => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus("开始增量生成台本...");

      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startFromSegmentId,
          options: {
            includeNarration: true,
            emotionDetection: true,
            contextAnalysis: true,
            minDialogueLength: 5,
            maxDialogueLength: 200,
            preserveOriginalBreaks: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "增量生成失败");
      }

      const result = await response.json();
      setGenerationStatus("增量台本生成任务已启动！");
      setShowIncrementalOptions(false);

      // Poll for progress (same as regular generation)
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `/api/books/${bookId}/script/generate`
          );
          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            throw new Error("获取状态失败");
          }

          const statusResult = await statusResponse.json();
          const progress = statusResult.data.generationProgress || 0;
          const status = statusResult.data.scriptStatus;

          setGenerationProgress(progress);

          if (status === "completed") {
            setGenerationStatus("增量台本生成完成！");
            clearInterval(pollInterval);
            await loadBookAndData();
            setIsGenerating(false);
          } else if (status === "failed") {
            setGenerationStatus("增量台本生成失败");
            clearInterval(pollInterval);
            setIsGenerating(false);
            alert("增量台本生成失败，请检查配置后重试");
          }
        } catch (error) {
          console.error("Polling error:", error);
          clearInterval(pollInterval);
          setGenerationStatus("获取状态失败");
          setIsGenerating(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setGenerationStatus("生成超时");
          setIsGenerating(false);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Failed to start incremental processing:", error);
      setGenerationStatus("增量台本生成失败");
      alert(
        `增量台本生成失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      setIsGenerating(false);
    }
  };

  // Regenerate specific segments
  const handleSegmentRegeneration = async (segmentIds: string[]) => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus("开始重新生成段落台本...");

      const response = await fetch(`/api/books/${bookId}/script/generate`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          segmentIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "段落重新生成失败");
      }

      const result = await response.json();
      setGenerationStatus("段落重新生成任务已启动！");
      setShowRegenerateOptions(false);
      setSelectedSegments([]);

      // Poll for progress (same as regular generation)
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `/api/books/${bookId}/script/generate`
          );
          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            throw new Error("获取状态失败");
          }

          const statusResult = await statusResponse.json();
          const progress = statusResult.data.generationProgress || 0;
          const status = statusResult.data.scriptStatus;

          setGenerationProgress(progress);

          if (status === "completed") {
            setGenerationStatus("段落重新生成完成！");
            clearInterval(pollInterval);
            await loadBookAndData();
            setIsGenerating(false);
          } else if (status === "failed") {
            setGenerationStatus("段落重新生成失败");
            clearInterval(pollInterval);
            setIsGenerating(false);
            alert("段落重新生成失败，请检查配置后重试");
          }
        } catch (error) {
          console.error("Polling error:", error);
          clearInterval(pollInterval);
          setGenerationStatus("获取状态失败");
          setIsGenerating(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setGenerationStatus("生成超时");
          setIsGenerating(false);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Failed to start segment regeneration:", error);
      setGenerationStatus("段落重新生成失败");
      alert(
        `段落重新生成失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      setIsGenerating(false);
    }
  };

  const clearScript = async () => {
    if (confirm("确定要清除所有台本吗？此操作不可恢复。")) {
      try {
        const response = await fetch(`/api/books/${bookId}/script/generate`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || "清除台本失败");
        }

        await loadBookAndData();
        alert("台本已清除");
      } catch (error) {
        console.error("Failed to clear script:", error);
        alert(
          `清除台本失败: ${error instanceof Error ? error.message : "未知错误"}`
        );
      }
    }
  };

  if (loading) {
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

  const hasTextSegments = segments.length > 0;
  const hasScriptSentences = scriptSentences.length > 0;
  const hasCharacters = characters.filter((c) => c.isActive).length > 0;

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
                  台本生成
                </h1>
                <p className="text-sm text-gray-500">{book.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">{scriptSentences.length} 句台词</Badge>
              <Button
                variant="outline"
                onClick={() => router.push(`/books/${bookId}/audio`)}
                disabled={!hasScriptSentences}
              >
                <Zap className="w-4 h-4 mr-2" />
                生成音频
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Generation Progress */}
        {(isGenerating || generationStatus) && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                ) : generationStatus.includes("完成") ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : generationStatus.includes("失败") ? (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                ) : (
                  <FileText className="w-6 h-6 text-blue-600" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {generationStatus}
                  </p>
                  {isGenerating && (
                    <Progress value={generationProgress} className="mt-2" />
                  )}
                </div>
                {!isGenerating && generationStatus.includes("完成") && (
                  <Button onClick={() => setShowScriptPreview(true)} size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    查看台本
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Script Generation Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  台本生成
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!hasTextSegments ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      需要先处理文本段落
                    </h3>
                    <p className="text-gray-600 mb-4">
                      请先在文本段落页面处理书籍内容
                    </p>
                    <Button
                      onClick={() => router.push(`/books/${bookId}/segments`)}
                      variant="outline"
                    >
                      查看文本段落
                    </Button>
                  </div>
                ) : !hasScriptSentences ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      生成台本
                    </h3>
                    <p className="text-gray-600 mb-6">
                      从前两个段落中提取对话内容，生成用于音频录制的台本
                    </p>
                    <Button
                      onClick={generateScript}
                      disabled={isGenerating}
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          生成前两段台本
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-900">
                            台本已生成
                          </p>
                          <p className="text-sm text-green-700">
                            从 {segments.length} 个段落中提取了{" "}
                            {scriptSentences.length} 句台词
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowScriptPreview(true)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          预览
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportScript}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          导出
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={regenerateScript}
                          disabled={isGenerating}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          重新生成
                        </Button>
                      </div>
                    </div>

                    {/* Incremental Processing Actions */}
                    <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-600 w-full mb-2">
                        高级选项 (从特定段落开始处理或重新生成指定段落):
                      </div>

                      <Button
                        onClick={() => {
                          setShowIncrementalOptions(true);
                          loadSegmentStatus();
                        }}
                        variant="outline"
                        size="sm"
                        disabled={isGenerating}
                      >
                        <SkipForward className="w-4 h-4 mr-2" />
                        增量处理
                      </Button>

                      <Button
                        onClick={() => {
                          setShowRegenerateOptions(true);
                          loadSegmentStatus();
                        }}
                        variant="outline"
                        size="sm"
                        disabled={isGenerating}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成段落
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Character Assignment */}
            {hasScriptSentences && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      角色分配
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setShowCharacterAssignment(!showCharacterAssignment)
                      }
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {showCharacterAssignment ? "收起" : "配置"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">已分配角色</span>
                      <span className="font-medium">
                        {scriptSentences.filter((s) => s.character).length} /{" "}
                        {scriptSentences.length}
                      </span>
                    </div>
                    <Progress
                      value={
                        scriptSentences.length > 0
                          ? (scriptSentences.filter((s) => s.character).length /
                              scriptSentences.length) *
                            100
                          : 0
                      }
                      className="mt-2"
                    />
                  </div>

                  {showCharacterAssignment && (
                    <div className="space-y-4">
                      {scriptSentences.slice(0, 10).map((sentence) => (
                        <div
                          key={sentence.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 line-clamp-2">
                              {sentence.text}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              段落{" "}
                              {sentence.segment?.orderIndex
                                ? sentence.segment.orderIndex + 1
                                : sentence.orderInSegment + 1}
                            </p>
                          </div>
                          <select
                            className="ml-4 px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={sentence.characterId || ""}
                            onChange={(e) => {
                              const newSentences = scriptSentences.map((s) =>
                                s.id === sentence.id
                                  ? { ...s, characterId: e.target.value }
                                  : s
                              );
                              setScriptSentences(newSentences);
                            }}
                          >
                            <option value="">选择角色</option>
                            <option value="">旁白</option>
                            {characters
                              .filter((c) => c.isActive)
                              .map((character) => (
                                <option key={character.id} value={character.id}>
                                  {character.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))}

                      <div className="flex justify-end pt-4">
                        <Button onClick={handleCharacterAssignment}>
                          保存分配
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Script Sentences List */}
            {hasScriptSentences && (
              <Card>
                <CardHeader>
                  <CardTitle>台词列表</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {scriptSentences.map((sentence, index) => (
                      <div
                        key={sentence.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm font-medium text-gray-500">
                              #{index + 1}
                            </span>
                            {sentence.character && (
                              <Badge variant="outline">
                                <User className="w-3 h-3 mr-1" />
                                {sentence.character.name}
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500">
                              段落{" "}
                              {sentence.segment?.orderIndex
                                ? sentence.segment.orderIndex + 1
                                : sentence.orderInSegment + 1}
                            </span>
                          </div>
                          <p className="text-gray-900">{sentence.text}</p>
                        </div>
                        <div className="flex space-x-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSentence(sentence)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSentenceDelete(sentence.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle>状态概览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">文本段落</span>
                    <Badge variant={hasTextSegments ? "default" : "secondary"}>
                      {segments.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">台本句子</span>
                    <Badge
                      variant={hasScriptSentences ? "default" : "secondary"}
                    >
                      {scriptSentences.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">角色数量</span>
                    <Badge variant={hasCharacters ? "default" : "secondary"}>
                      {characters.filter((c) => c.isActive).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">已分配台词</span>
                    <Badge variant="outline">
                      {scriptSentences.filter((s) => s.character).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>快捷操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/books/${bookId}/segments`)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  查看文本段落
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/books/${bookId}/characters`)}
                >
                  <User className="w-4 h-4 mr-2" />
                  管理角色
                </Button>
                {hasScriptSentences && (
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/books/${bookId}/audio`)}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    生成音频
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle>提示</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p>台本会自动从文本段落中提取对话内容</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p>为台词分配角色以获得更好的音频效果</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p>可以编辑和调整台词内容</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Script Preview Modal */}
      {showScriptPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>台本预览</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScriptPreview(false)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {scriptSentences.map((sentence, index) => (
                  <div
                    key={sentence.id}
                    className="border-l-4 border-blue-500 pl-4"
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      {sentence.character && (
                        <Badge variant="outline">
                          {sentence.character.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-900">{sentence.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Sentence Modal */}
      {editingSentence && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>编辑台词</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    台词内容
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    defaultValue={editingSentence.text}
                    id="edit-sentence-text"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setEditingSentence(null)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={() => {
                      const newText = (
                        document.getElementById(
                          "edit-sentence-text"
                        ) as HTMLTextAreaElement
                      ).value;
                      handleSentenceEdit(editingSentence.id, newText);
                    }}
                    className="flex-1"
                  >
                    保存
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Incremental Processing Modal */}
      {showIncrementalOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>增量处理台本</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowIncrementalOptions(false)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    选择开始段落，系统将从该段落开始继续生成台本，已生成的段落保持不变。
                  </p>
                </div>

                {segmentStatusLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>加载段落状态中...</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {segmentStatus.map((segment) => (
                      <div
                        key={segment.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedStartSegment === segment.id
                            ? "border-blue-500 bg-blue-50"
                            : segment.processed
                            ? "border-green-200 bg-green-50 hover:bg-green-100"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedStartSegment(segment.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              段落 {segment.orderIndex + 1}
                            </span>
                            {segment.processed && (
                              <Badge
                                variant="outline"
                                className="text-green-600 border-green-300"
                              >
                                已处理
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {segment.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {segment.wordCount} 字符
                            {segment.processed &&
                              ` • ${segment.lineCount} 句台词`}
                          </p>
                        </div>
                        <div className="ml-4">
                          {selectedStartSegment === segment.id ? (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex space-x-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowIncrementalOptions(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={() =>
                      selectedStartSegment &&
                      handleIncrementalProcessing(selectedStartSegment)
                    }
                    disabled={!selectedStartSegment || isGenerating}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <SkipForward className="w-4 h-4 mr-2" />
                        开始增量处理
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Segment Regeneration Modal */}
      {showRegenerateOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>重新生成段落台本</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRegenerateOptions(false)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    选择要重新生成的段落，系统将删除这些段落的现有台词并重新生成。
                  </p>
                  <div className="flex items-center space-x-4 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSegments(
                          segmentStatus
                            .filter((s) => s.processed)
                            .map((s) => s.id)
                        );
                      }}
                    >
                      选择所有已处理
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSegments([])}
                    >
                      清除选择
                    </Button>
                    <span className="text-sm text-gray-600">
                      已选择 {selectedSegments.length} 个段落
                    </span>
                  </div>
                </div>

                {segmentStatusLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>加载段落状态中...</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {segmentStatus.map((segment) => (
                      <div
                        key={segment.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedSegments.includes(segment.id)
                            ? "border-blue-500 bg-blue-50"
                            : segment.processed
                            ? "border-green-200 bg-green-50 hover:bg-green-100"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        }`}
                        onClick={() => {
                          if (segment.processed) {
                            setSelectedSegments((prev) =>
                              prev.includes(segment.id)
                                ? prev.filter((id) => id !== segment.id)
                                : [...prev, segment.id]
                            );
                          }
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              段落 {segment.orderIndex + 1}
                            </span>
                            {segment.processed && (
                              <Badge
                                variant="outline"
                                className="text-green-600 border-green-300"
                              >
                                已处理
                              </Badge>
                            )}
                            {!segment.processed && (
                              <Badge
                                variant="secondary"
                                className="text-gray-600"
                              >
                                未处理
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {segment.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {segment.wordCount} 字符
                            {segment.processed &&
                              ` • ${segment.lineCount} 句台词`}
                          </p>
                        </div>
                        <div className="ml-4">
                          {selectedSegments.includes(segment.id) ? (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          ) : segment.processed ? (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-blue-500" />
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-200 rounded-full bg-gray-100" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex space-x-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowRegenerateOptions(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={() =>
                      selectedSegments.length > 0 &&
                      handleSegmentRegeneration(selectedSegments)
                    }
                    disabled={selectedSegments.length === 0 || isGenerating}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        重新生成中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成 {selectedSegments.length} 个段落
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
