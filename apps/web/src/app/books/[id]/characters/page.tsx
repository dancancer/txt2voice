// 一旦我被更新，请更新我的开头注释
// input: 路由参数/客户端数据
// output: 页面 UI
// pos: 路由页面入口
"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CharactersHeader,
  SearchInfoBar,
  AcquisitionCards,
  PaginationBar,
} from "./components";
import { CharactersTable } from "./table";
import { CharacterFormModal, SpeakerDialog } from "./dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Plus } from "lucide-react";
import { useBookCharacters } from "@/hooks/useBookCharacters";
import { useSpeakerBindings } from "@/hooks/useSpeakerBindings";

export default function CharacterProfilesPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const {
    book,
    characters,
    pagination,
    loading,
    searchTerm,
    setSearchTerm,
    reload,
    setCharacters,
    error,
  } = useBookCharacters(bookId);

  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<{
    scriptExtraction: boolean;
  }>({
    scriptExtraction: false,
  });
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [lastExtractionSummary, setLastExtractionSummary] = useState<string | null>(null);

  const segmentsCount =
    book?.counts?.segments ?? book?.textSegments?.length ?? 0;
  const hasTextSegments = segmentsCount > 0;
  const scriptsCount =
    book?.counts?.scripts ?? book?.scriptSentences?.length ?? 0;
  const hasScripts = scriptsCount > 0;

  const filteredCharacters = useMemo(() => characters, [characters]);

  const handlePageChange = (newPage: number) => {
    reload(newPage, searchTerm);
  };

  const handleCreateCharacter = async (characterData: any) => {
    try {
      setIsFormSubmitting(true);
      const response = await fetch(`/api/books/${bookId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: characterData.name,
          description: characterData.description,
          aliases: characterData.aliases,
          isActive: characterData.isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "创建角色失败");
      }
      toast.success("角色创建成功");
      setShowAddCharacter(false);
      await reload(pagination.page, searchTerm);
    } catch (error) {
      console.error("Failed to create character:", error);
      toast.error(
        error instanceof Error ? error.message : "角色创建失败，请重试"
      );
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleUpdateCharacter = async (id: string, characterData: any) => {
    try {
      setIsFormSubmitting(true);
      const response = await fetch(`/api/books/${bookId}/characters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: characterData.name,
          description: characterData.description,
          aliases: characterData.aliases,
          isActive: characterData.isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "更新角色失败");
      }
      toast.success("角色更新成功");
      setEditingCharacter(null);
      await reload(pagination.page, searchTerm);
    } catch (error) {
      console.error("Failed to update character:", error);
      toast.error(
        error instanceof Error ? error.message : "角色更新失败，请重试"
      );
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm("确定要删除这个角色吗？")) return;
    try {
      setDeletingCharacterId(id);
      const response = await fetch(`/api/books/${bookId}/characters/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "删除角色失败");
      }
      toast.success("角色已删除");
      await reload(pagination.page, searchTerm);
    } catch (error) {
      console.error("Failed to delete character:", error);
      toast.error(
        error instanceof Error ? error.message : "删除角色失败，请重试"
      );
    } finally {
      setDeletingCharacterId(null);
    }
  };

  const handleExtractFromScript = async () => {
    try {
      setActionLoading((prev) => ({ ...prev, scriptExtraction: true }));
      const response = await fetch(
        `/api/books/${bookId}/characters/from-script`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "台本抽取失败");
      }
      const summary = `新增 ${result.data.createdCount} 个角色，绑定 ${result.data.linkedSentences} 句台词`;
      setLastExtractionSummary(summary);
      toast.success(summary);
      await reload(1, searchTerm);
    } catch (error) {
      console.error("Failed to extract characters from script:", error);
      toast.error(
        error instanceof Error ? error.message : "台本抽取失败，请稍后重试"
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, scriptExtraction: false }));
    }
  };

  const {
    dialogOpen,
    dialogCharacter,
    bindings,
    availableSpeakers,
    selectedSpeakerId,
    setSelectedSpeakerId,
    isDialogLoading,
    isSpeakerListLoading,
    speakerActionLoading,
    updatingBindingId,
    removingBindingId,
    buildSpeakerPreviewSources,
    openDialog,
    closeDialog,
    addBinding,
    setDefaultBinding,
    removeBinding,
  } = useSpeakerBindings(bookId, setCharacters);

  const segmentsCountDisplay =
    book?.counts?.segments ?? book?.textSegments?.length ?? 0;

  if (loading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "书籍不存在"}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <CharactersHeader
        title={book.title}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onBack={() => router.push(`/books/${bookId}`)}
        onAdd={() => setShowAddCharacter(true)}
        disableAdd={!hasTextSegments}
      />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <SearchInfoBar
          search={searchTerm}
          onSearch={setSearchTerm}
          charactersCount={filteredCharacters.length}
          pagination={pagination}
          segmentsCount={segmentsCountDisplay}
        />

        <AcquisitionCards
          hasTextSegments={hasTextSegments}
          segmentsCount={segmentsCount}
          hasScripts={hasScripts}
          scriptsCount={scriptsCount}
          lastExtractionSummary={lastExtractionSummary}
          onAddCharacter={() => setShowAddCharacter(true)}
          onExtractFromScript={handleExtractFromScript}
          onOpenScript={() => router.push(`/books/${bookId}/studio/script`)}
          actionLoading={actionLoading}
        />

        {filteredCharacters.length > 0 ? (
          <>
            <CharactersTable
              characters={filteredCharacters}
              onEdit={(c) => setEditingCharacter(c)}
              onDelete={handleDeleteCharacter}
              onConfigSpeaker={(c) => openDialog(c)}
              onAudioSettings={(c) =>
                router.push(`/books/${bookId}/studio/audio?character=${c.id}`)
              }
              deletingId={deletingCharacterId}
            />
            <PaginationBar
              page={pagination.page}
              total={pagination.total}
              limit={pagination.limit}
              totalPages={pagination.totalPages}
              hasPrev={pagination.hasPrev}
              hasNext={pagination.hasNext}
              onChange={handlePageChange}
            />
          </>
        ) : (
          <Card>
            <CardContent className="pt-12 p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无角色配置
              </h3>
              <p className="text-gray-600 mb-6">
                角色配置用于为书中的人物分配不同的语音，让有声读物更加生动。
              </p>
              <div className="space-y-4">
                <Button
                  onClick={() => setShowAddCharacter(true)}
                  disabled={!hasTextSegments}
                  className="min-h-11"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个角色
                </Button>
                {!hasTextSegments ? (
                  <p className="text-sm text-gray-500">
                    请先完成文本处理，然后再创建角色配置
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <CharacterFormModal
        open={showAddCharacter || !!editingCharacter}
        character={editingCharacter}
        onClose={() => {
          setShowAddCharacter(false);
          setEditingCharacter(null);
        }}
        onSubmit={
          editingCharacter
            ? (data) => handleUpdateCharacter(editingCharacter.id, data)
            : handleCreateCharacter
        }
        isSubmitting={isFormSubmitting}
      />

      <SpeakerDialog
        open={dialogOpen}
        character={dialogCharacter}
        bindings={bindings}
        availableSpeakers={availableSpeakers}
        selectedSpeakerId={selectedSpeakerId}
        onSelectSpeaker={setSelectedSpeakerId}
        onClose={closeDialog}
        onAdd={addBinding}
        onSetDefault={setDefaultBinding}
        onRemove={removeBinding}
        buildPreview={buildSpeakerPreviewSources}
        isDialogLoading={isDialogLoading}
        isSpeakerListLoading={isSpeakerListLoading}
        speakerActionLoading={speakerActionLoading}
        updatingBindingId={updatingBindingId}
        removingBindingId={removingBindingId}
      />
    </div>
  );
}
