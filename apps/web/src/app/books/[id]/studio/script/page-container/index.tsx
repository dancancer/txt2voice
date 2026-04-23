// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScriptSentence } from "@/lib/types";
import {
  BookWorkbench,
  ChapterWorkbench,
  DocumentTree,
  EditSentenceModal,
  GenerationProgress,
  IncrementalProcessingModal,
  RegenerateSegmentsModal,
  SegmentWorkbench,
  ScriptPreviewModal,
  type ScriptNavigationNode,
} from "../components";
import { ScriptStudioAdvancedActionsPanel } from "./components/AdvancedActionsPanel";
import { ScriptStudioErrorState, ScriptStudioLoadingState } from "./components/PageStates";
import { useConfirmDialog } from "./hooks/useConfirmDialog";
import { useScriptStudioData } from "./hooks/useScriptStudioData";
import { useScriptGenerationActions } from "./hooks/actions/useScriptGenerationActions";
import { useScriptScopeActions } from "./hooks/actions/useScriptScopeActions";
import { useScriptSentenceActions } from "./hooks/actions/useScriptSentenceActions";
import {
  buildScriptStudioHref,
  isSameScriptStudioNode,
  parseScriptStudioNodeQuery,
} from "./node-query";

export function ScriptStudioPageContainer() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = params.id as string;

  const [editingSentence, setEditingSentence] = useState<ScriptSentence | null>(
    null
  );
  const [showScriptPreview, setShowScriptPreview] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ScriptNavigationNode>(() =>
    parseScriptStudioNodeQuery(bookId, searchParams.get("node"))
  );

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
    latestFailedReviewTaskBySegment,
    bookStats,
    getSelectedState,
  } = useScriptStudioData(bookId);

  const { confirmDialog, requestConfirmation, resolveConfirmation } =
    useConfirmDialog();

  const {
    isGenerating,
    generationProgress,
    generationStatus,
    generationEvents,
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

  useEffect(() => {
    const nextNode = parseScriptStudioNodeQuery(bookId, searchParams.get("node"));
    setSelectedNode((currentNode) =>
      isSameScriptStudioNode(currentNode, nextNode) ? currentNode : nextNode
    );
  }, [bookId, searchParams]);

  const handleSelectNode = (node: ScriptNavigationNode) => {
    setSelectedNode(node);
    router.replace(buildScriptStudioHref(bookId, node), { scroll: false });
  };

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
  const selectedSegmentFailedReviewTask = selectedSegment
    ? latestFailedReviewTaskBySegment.get(selectedSegment.id) || null
    : null;

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

  const currentSegmentLabel = selectedSegmentMeta
    ? `${selectedSegmentMeta.chapterTitle} · ${selectedSegmentMeta.label}`
    : selectedSegment
      ? `段落 #${(selectedSegment.segmentIndex ?? 0) + 1}`
      : null;

  const handleOpenIncrementalOptions = async () => {
    setShowIncrementalOptions(true);
    await loadSegmentStatus();
  };

  const handleOpenRegenerateOptions = async () => {
    setShowRegenerateOptions(true);
    await loadSegmentStatus();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {(isGenerating || generationStatus || generationEvents.length > 0) && (
        <div className="flex-shrink-0">
          <GenerationProgress
            isGenerating={isGenerating}
            generationStatus={generationStatus}
            generationProgress={generationProgress}
            generationEvents={generationEvents}
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
              onSelect={handleSelectNode}
            />
          </div>

          <div className="h-full overflow-auto">
            <div className="h-full space-y-4">
              <ScriptStudioAdvancedActionsPanel
                hasTextSegments={hasTextSegments}
                isGenerating={isGenerating}
                canGenerateScript={canGenerateScript}
                currentSegmentLabel={currentSegmentLabel}
                onOpenIncrementalOptions={handleOpenIncrementalOptions}
                onOpenRegenerateOptions={handleOpenRegenerateOptions}
                onRegenerateCurrentSegment={
                  selectedSegment
                    ? () =>
                        handleScopeScriptGeneration("segment", selectedSegment.id)
                    : undefined
                }
              />

              {safeSelectedNode.type === "chapter" && selectedChapterNode && (
                <ChapterWorkbench
                  bookId={bookId}
                  chapter={selectedChapterNode}
                  titleAction={titleAction}
                  failedReviewTaskBySegment={latestFailedReviewTaskBySegment}
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
                  onSelectSegment={(segmentId) =>
                    handleSelectNode({ type: "segment", id: segmentId })
                  }
                  onGenerateSegmentScript={(segmentId) =>
                    handleScopeScriptGeneration("segment", segmentId)
                  }
                  onGenerateSegmentAudio={(segmentId) =>
                    handleScopeAudioGeneration("segment", segmentId)
                  }
                  onGenerateChapterScript={() =>
                    handleScopeScriptGeneration("chapter", selectedChapterNode.id)
                  }
                  onGenerateChapterAudio={() =>
                    handleScopeAudioGeneration("chapter", selectedChapterNode.id)
                  }
                />
              )}

              {safeSelectedNode.type === "segment" && selectedSegment && (
                <SegmentWorkbench
                  bookId={bookId}
                  title={
                    selectedSegmentMeta?.label ||
                    `段落 #${(selectedSegment.segmentIndex ?? 0) + 1}`
                  }
                  segment={selectedSegment}
                  sentences={selectedSegmentSentences}
                  characters={characters}
                  failedReviewTask={selectedSegmentFailedReviewTask}
                  onRegenerateScript={() =>
                    handleScopeScriptGeneration("segment", selectedSegment.id)
                  }
                  onGenerateAudio={() =>
                    handleScopeAudioGeneration("segment", selectedSegment.id)
                  }
                  onEditSentence={setEditingSentence}
                  onDeleteSentence={handleSentenceDelete}
                  onGenerateSentenceAudio={handleSentenceAudioGeneration}
                />
              )}

              {safeSelectedNode.type === "book" && (
                <BookWorkbench
                  bookTitle={book.title}
                  bookStats={bookStats}
                  chapters={chapterNodes}
                  failedReviewTaskBySegment={latestFailedReviewTaskBySegment}
                  llmModels={llmModels}
                  selectedLLMModelId={selectedLLMModelId}
                  llmModelsLoading={llmModelsLoading}
                  llmModelsError={llmModelsError}
                  isGenerating={isGenerating}
                  hasTextSegments={hasTextSegments}
                  hasScriptSentences={hasScriptSentences}
                  canGenerateScript={canGenerateScript}
                  onSelectNode={handleSelectNode}
                  onSelectLLMModelId={setSelectedLLMModelId}
                  onGenerateBookScript={() => handleScopeScriptGeneration("book")}
                  onGenerateBookAudio={() => handleScopeAudioGeneration("book")}
                />
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
          bookId={bookId}
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
          <p className="text-sm text-muted-foreground">{confirmDialog.description}</p>
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
