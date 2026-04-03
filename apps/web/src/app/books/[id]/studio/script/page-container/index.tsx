// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScriptSentence } from "@/lib/types";
import {
  ChapterSegmentsTable,
  DocumentTree,
  EditSentenceModal,
  GenerationProgress,
  IncrementalProcessingModal,
  RegenerateSegmentsModal,
  ScriptPreviewModal,
  ScriptSentencesTable,
  type ScriptNavigationNode,
} from "../components";
import { ScriptStudioErrorState, ScriptStudioLoadingState } from "./components/PageStates";
import { useConfirmDialog } from "./hooks/useConfirmDialog";
import { useScriptStudioData } from "./hooks/useScriptStudioData";
import { useScriptGenerationActions } from "./hooks/actions/useScriptGenerationActions";
import { useScriptScopeActions } from "./hooks/actions/useScriptScopeActions";
import { useScriptSentenceActions } from "./hooks/actions/useScriptSentenceActions";

export function ScriptStudioPageContainer() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [editingSentence, setEditingSentence] = useState<ScriptSentence | null>(
    null
  );
  const [showScriptPreview, setShowScriptPreview] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ScriptNavigationNode>({
    type: "book",
    id: bookId,
  });

  const {
    book,
    segments,
    characters,
    scriptSentences,
    loading,
    error,
    setScriptSentences,
    loadBookAndData,
    hasTextSegments,
    hasScriptSentences,
    sentencesBySegment,
    chapterNodes,
    chapterSegmentIds,
    segmentMetaMap,
    bookStats,
    getSelectedState,
  } = useScriptStudioData(bookId);

  const { confirmDialog, requestConfirmation, resolveConfirmation } =
    useConfirmDialog();

  const {
    isGenerating,
    generationProgress,
    generationStatus,
    showIncrementalOptions,
    setShowIncrementalOptions,
    llmModels,
    selectedLLMModelId,
    setSelectedLLMModelId,
    llmModelsLoading,
    llmModelsError,
    canGenerateScript,
    selectedStartSegment,
    setSelectedStartSegment,
    segmentStatus,
    showRegenerateOptions,
    setShowRegenerateOptions,
    selectedSegments,
    setSelectedSegments,
    segmentStatusLoading,
    generateScript,
    loadSegmentStatus,
    handleIncrementalProcessing,
    handleSegmentRegeneration,
  } = useScriptGenerationActions({
    bookId,
    segments,
    hasTextSegments,
    requestConfirmation,
    loadBookAndData,
  });

  const { handleScopeScriptGeneration, handleScopeAudioGeneration } =
    useScriptScopeActions({
      bookId,
      hasScriptSentences,
      chapterSegmentIds,
      sentencesBySegment,
      requestConfirmation,
      generateScript,
      handleSegmentRegeneration,
    });

  const {
    handleSentenceEdit,
    handleSentenceDelete,
    handleSentenceAudioGeneration,
  } = useScriptSentenceActions({
    bookId,
    characters,
    scriptSentences,
    setScriptSentences,
    setEditingSentence,
    requestConfirmation,
  });

  useEffect(() => {
    const controller = new AbortController();
    void loadBookAndData(controller.signal);
    return () => controller.abort();
  }, [loadBookAndData]);

  const safeSelectedNode = useMemo(() => {
    if (selectedNode.type === "book" && selectedNode.id !== bookId) {
      return { type: "book", id: bookId } as ScriptNavigationNode;
    }
    if (
      selectedNode.type === "chapter" &&
      !chapterNodes.some((chapter) => chapter.id === selectedNode.id)
    ) {
      return { type: "book", id: bookId } as ScriptNavigationNode;
    }
    if (
      selectedNode.type === "segment" &&
      !segmentMetaMap.has(selectedNode.id)
    ) {
      return { type: "book", id: bookId } as ScriptNavigationNode;
    }
    return selectedNode;
  }, [bookId, chapterNodes, segmentMetaMap, selectedNode]);

  const {
    selectedChapterNode,
    selectedSegment,
    selectedSegmentSentences,
    selectedSegmentMeta,
  } = getSelectedState(safeSelectedNode);

  if (loading) {
    return <ScriptStudioLoadingState />;
  }

  if (error || !book) {
    return (
      <ScriptStudioErrorState
        message={error || "书籍不存在"}
        onBack={() => router.back()}
      />
    );
  }

  const titleAction = selectedChapterNode && (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => handleScopeScriptGeneration("chapter", selectedChapterNode.id)}
        disabled={isGenerating || !canGenerateScript}
      >
        章节台本生成
      </Button>
      <Button
        variant="outline"
        onClick={() => handleScopeAudioGeneration("chapter", selectedChapterNode.id)}
        disabled={isGenerating || selectedChapterNode.scriptSegments === 0}
      >
        章节音频生成
      </Button>
    </div>
  );

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
      {isGenerating && (
        <div className="flex-shrink-0">
          <GenerationProgress
            isGenerating={isGenerating}
            generationStatus={generationStatus}
            generationProgress={generationProgress}
            onShowPreview={() => setShowScriptPreview(true)}
          />
        </div>
      )}
      <div className="flex-1 overflow-hidden p-2">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="h-full overflow-hidden">
            <DocumentTree
              bookId={bookId}
              bookTitle={book.title}
              bookStats={bookStats}
              chapters={chapterNodes}
              selectedNode={safeSelectedNode}
              onSelect={setSelectedNode}
            />
          </div>

          <div className="h-full overflow-auto">
            <div className="space-y-4 h-full ">
              {safeSelectedNode.type === "chapter" && selectedChapterNode && (
                <ChapterSegmentsTable
                  chapterTitle={selectedChapterNode.title}
                  titleAction={titleAction}
                  segments={selectedChapterNode.segments.map((seg) => {
                    const fullSegment = segments.find((s) => s.id === seg.id);
                    return {
                      id: seg.id,
                      orderIndex: fullSegment?.orderIndex ?? 0,
                      chapterOrderIndex: fullSegment?.chapterOrderIndex ?? undefined,
                      content: fullSegment?.content ?? "",
                      wordCount: fullSegment?.wordCount ?? undefined,
                      hasScript: seg.hasScript,
                      hasAudio: seg.hasAudio,
                    };
                  })}
                  onSegmentClick={(segmentId) =>
                    setSelectedNode({ type: "segment", id: segmentId })
                  }
                  onGenerateScript={(segmentId) =>
                    handleScopeScriptGeneration("segment", segmentId)
                  }
                  onGenerateAudio={(segmentId) =>
                    handleScopeAudioGeneration("segment", segmentId)
                  }
                />
              )}

              {safeSelectedNode.type === "segment" && selectedSegment && (
                <>
                  <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg border sticky top-0 z-10">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {selectedSegmentMeta
                          ? `${selectedSegmentMeta.chapterTitle} · ${selectedSegmentMeta.label}`
                          : `段落 #${(selectedSegment.segmentIndex ?? 0) + 1}`}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        字数 {selectedSegment.wordCount ?? selectedSegment.content?.length ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() =>
                          handleScopeScriptGeneration("segment", selectedSegment.id)
                        }
                        disabled={isGenerating || !canGenerateScript}
                      >
                        重生成台本
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleScopeAudioGeneration("segment", selectedSegment.id)
                        }
                        disabled={isGenerating || selectedSegmentSentences.length === 0}
                      >
                        生成语音
                      </Button>
                    </div>
                  </div>
                  <ScriptSentencesTable
                    segmentTitle={
                      selectedSegmentMeta?.label ||
                      `段落 #${(selectedSegment.segmentIndex ?? 0) + 1}`
                    }
                    sentences={selectedSegmentSentences}
                    onEdit={setEditingSentence}
                    onDelete={handleSentenceDelete}
                    onGenerateAudio={handleSentenceAudioGeneration}
                  />
                </>
              )}

              {safeSelectedNode.type === "book" && (
                <div className="border border-dashed rounded-lg p-12 text-center bg-white">
                  <div className="max-w-md mx-auto">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      章节管理 & 台本生成
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      请在左侧选择一个章节查看段落列表，或选择段落查看台词详情。
                    </p>
                    <div className="mb-4 text-left">
                      <label
                        className="mb-2 block text-sm font-medium text-gray-700"
                        htmlFor="script-llm-model"
                      >
                        台本模型
                      </label>
                      <select
                        id="script-llm-model"
                        aria-label="台本模型"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                        value={selectedLLMModelId}
                        onChange={(event) => setSelectedLLMModelId(event.target.value)}
                        disabled={llmModelsLoading || llmModels.length === 0}
                      >
                        {llmModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label} ({model.model})
                          </option>
                        ))}
                      </select>
                      {llmModelsError ? (
                        <p className="mt-2 text-sm text-red-600">{llmModelsError}</p>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">
                          当前选择会用于全书、章节、段落与增量重生成。
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Button
                        className="w-full"
                        onClick={() => handleScopeScriptGeneration("book")}
                        disabled={isGenerating || !hasTextSegments || !canGenerateScript}
                      >
                        全书台本生成
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleScopeAudioGeneration("book")}
                        disabled={isGenerating || !hasScriptSentences}
                      >
                        全书音频生成
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showScriptPreview && (
        <ScriptPreviewModal
          scriptSentences={scriptSentences}
          onClose={() => setShowScriptPreview(false)}
        />
      )}

      {editingSentence && (
        <EditSentenceModal
          key={editingSentence.id}
          sentence={editingSentence}
          characters={characters}
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
              segmentStatus.filter((item) => item.processed).map((item) => item.id)
            );
          }}
          onClearSelection={() => setSelectedSegments([])}
          onStartRegeneration={handleSegmentRegeneration}
        />
      )}

      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            resolveConfirmation(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">{confirmDialog.description}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => resolveConfirmation(false)}>
              {confirmDialog.cancelText}
            </Button>
            <Button
              variant={confirmDialog.destructive ? "destructive" : "default"}
              onClick={() => resolveConfirmation(true)}
            >
              {confirmDialog.confirmText}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
