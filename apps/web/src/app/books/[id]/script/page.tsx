"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { booksApi } from "@/lib/api";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScriptSentence, CharacterProfile } from "@/lib/types";
import {
  SegmentStatus,
  ScriptHeader,
  GenerationProgress,
  ScriptGenerationCard,
  CharacterAssignment,
  ScriptSentencesList,
  StatusSidebar,
  ScriptPreviewModal,
  EditSentenceModal,
  IncrementalProcessingModal,
  RegenerateSegmentsModal,
} from "./components";

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

  // Character assignment state
  const [showCharacterAssignment, setShowCharacterAssignment] = useState(false);

  // Incremental processing state
  const [showIncrementalOptions, setShowIncrementalOptions] = useState(false);
  const [selectedStartSegment, setSelectedStartSegment] = useState<
    string | null
  >(null);
  const [segmentStatus, setSegmentStatus] = useState<SegmentStatus[]>([]);

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

      if (!hasTextSegments) {
        alert("没有文本段落，请先处理文本");
        setIsGenerating(false);
        return;
      }

      const firstTwoSegments = segments.slice(0, 2);
      if (firstTwoSegments.length === 0) {
        alert("没有可处理的文本段落");
        setIsGenerating(false);
        return;
      }

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
            limitToSegments: 2,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "生成失败");
      }

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
      console.log("Assigning characters:", scriptSentences);
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
      const scriptContent = scriptSentences
        .map((sentence) => {
          const characterName = sentence.character?.canonicalName || "旁白";
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
          startFromSegmentId: startSegmentId,
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

      setGenerationStatus("增量台本生成任务已启动！");
      setShowIncrementalOptions(false);

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

      setGenerationStatus("段落重新生成任务已启动！");
      setShowRegenerateOptions(false);
      setSelectedSegments([]);

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

  const handleSentenceCharacterChange = (
    sentenceId: string,
    characterId: string
  ) => {
    const newSentences = scriptSentences.map((s) =>
      s.id === sentenceId ? { ...s, characterId } : s
    );
    setScriptSentences(newSentences);
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
      <ScriptHeader
        bookId={bookId}
        bookTitle={book.title}
        scriptSentencesCount={scriptSentences.length}
        hasScriptSentences={hasScriptSentences}
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GenerationProgress
          isGenerating={isGenerating}
          generationStatus={generationStatus}
          generationProgress={generationProgress}
          onShowPreview={() => setShowScriptPreview(true)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            <ScriptGenerationCard
              bookId={bookId}
              hasTextSegments={hasTextSegments}
              hasScriptSentences={hasScriptSentences}
              isGenerating={isGenerating}
              segmentsCount={segments.length}
              scriptSentencesCount={scriptSentences.length}
              onGenerate={generateScript}
              onRegenerate={regenerateScript}
              onExport={exportScript}
              onShowPreview={() => setShowScriptPreview(true)}
              onShowIncremental={() => {
                setShowIncrementalOptions(true);
                loadSegmentStatus();
              }}
              onShowRegenerate={() => {
                setShowRegenerateOptions(true);
                loadSegmentStatus();
              }}
            />

            {hasScriptSentences && (
              <>
                <CharacterAssignment
                  scriptSentences={scriptSentences}
                  characters={characters}
                  showCharacterAssignment={showCharacterAssignment}
                  onToggleAssignment={() =>
                    setShowCharacterAssignment(!showCharacterAssignment)
                  }
                  onSentenceCharacterChange={handleSentenceCharacterChange}
                  onSaveAssignment={handleCharacterAssignment}
                />

                <ScriptSentencesList
                  scriptSentences={scriptSentences}
                  onEdit={setEditingSentence}
                  onDelete={handleSentenceDelete}
                />
              </>
            )}
          </div>

          {/* Right Sidebar */}
          <StatusSidebar
            bookId={bookId}
            segmentsCount={segments.length}
            scriptSentencesCount={scriptSentences.length}
            charactersCount={characters.filter((c) => c.isActive).length}
            assignedSentencesCount={
              scriptSentences.filter((s) => s.character && s.character.id)
                .length
            }
            hasTextSegments={hasTextSegments}
            hasScriptSentences={hasScriptSentences}
            hasCharacters={hasCharacters}
          />
        </div>
      </div>

      {/* Modals */}
      {showScriptPreview && (
        <ScriptPreviewModal
          scriptSentences={scriptSentences}
          onClose={() => setShowScriptPreview(false)}
        />
      )}

      {editingSentence && (
        <EditSentenceModal
          sentence={editingSentence}
          onClose={() => setEditingSentence(null)}
          onSave={handleSentenceEdit}
        />
      )}

      {showIncrementalOptions && (
        <IncrementalProcessingModal
          segmentStatus={segmentStatus}
          selectedStartSegment={selectedStartSegment}
          isGenerating={isGenerating}
          segmentStatusLoading={segmentStatusLoading}
          onClose={() => setShowIncrementalOptions(false)}
          onSelectSegment={setSelectedStartSegment}
          onStartProcessing={handleIncrementalProcessing}
        />
      )}

      {showRegenerateOptions && (
        <RegenerateSegmentsModal
          segmentStatus={segmentStatus}
          selectedSegments={selectedSegments}
          isGenerating={isGenerating}
          segmentStatusLoading={segmentStatusLoading}
          onClose={() => setShowRegenerateOptions(false)}
          onToggleSegment={(segmentId) => {
            setSelectedSegments((prev) =>
              prev.includes(segmentId)
                ? prev.filter((id) => id !== segmentId)
                : [...prev, segmentId]
            );
          }}
          onSelectAllProcessed={() => {
            setSelectedSegments(
              segmentStatus.filter((s) => s.processed).map((s) => s.id)
            );
          }}
          onClearSelection={() => setSelectedSegments([])}
          onStartRegeneration={handleSegmentRegeneration}
        />
      )}
    </div>
  );
}
