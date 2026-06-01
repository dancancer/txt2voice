// 一旦我被更新，请更新我的开头注释
// input: props/TTS 依赖
// output: TTS UI
// pos: 领域组件
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateSpeakerDialog } from "./speaker-management/dialogs/CreateSpeakerDialog";
import { EditSpeakerDialog } from "./speaker-management/dialogs/EditSpeakerDialog";
import { UploadAudioDialog } from "./speaker-management/dialogs/UploadAudioDialog";
import { useSpeakerManagementController } from "./speaker-management/hooks/useSpeakerManagementController";
import { SpeakerListTab } from "./speaker-management/panels/SpeakerListTab";
import { ReferenceAudioTab } from "./speaker-management/panels/ReferenceAudioTab";
import { SpeakerFilters } from "./speaker-management/SpeakerFilters";

const PROVIDER_OPTIONS = [
  { value: "voxcpm", label: "VoxCPM2" },
] as const;

export function SpeakerManagement() {
  const controller = useSpeakerManagementController();
  const providerStatusMap = new Map(
    controller.providerStatuses.map((item) => [item.provider, item])
  );

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">语音库管理</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/">上传书籍</Link>
          </Button>
          {!controller.supportsSpeakerManagement && (
            <Button asChild>
              <a
                href={controller.selectedProviderStatus?.endpoint || "http://192.168.88.9:18083"}
                target="_blank"
                rel="noreferrer"
              >
                打开 VoxCPM2 服务
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-card-foreground">语音服务配置</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={controller.refreshProviderStatuses}
            disabled={controller.providerStatusLoading}
          >
            {controller.providerStatusLoading ? "检测中..." : "刷新状态"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PROVIDER_OPTIONS.map((option) => {
            const status = providerStatusMap.get(option.value);
            const statusText = status
              ? status.healthy
                ? "在线"
                : "离线"
              : "未检测";
            const statusClass = status
              ? status.healthy
                ? "bg-emerald-100 text-emerald-700"
                : "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground";

            return (
              <div
                key={option.value}
                className={`rounded-lg border p-3 ${
                  controller.selectedProvider === option.value
                    ? "border-border bg-accent/60"
                    : "border-border bg-card"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-foreground">{option.label}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
                  >
                    {statusText}
                  </span>
                </div>
                <p className="mb-2 break-all text-xs text-muted-foreground">
                  {status?.endpoint || "等待状态检测"}
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {status?.message || "点击刷新状态后可查看服务连通性"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    controller.selectedProvider === option.value
                      ? "default"
                      : "outline"
                  }
                  onClick={() => controller.setSelectedProvider(option.value)}
                  className="w-full"
                >
                  {controller.selectedProvider === option.value
                    ? "当前使用中"
                    : "切换到此服务"}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          如需修改服务地址，请更新 `.env` 中 `VOXCPM_API_URL` 后重启
          `web` 容器。
        </p>
      </div>

      {controller.supportsSpeakerManagement && (
        <SpeakerFilters
          searchTerm={controller.searchTerm}
          filterGender={controller.filterGender}
          filterAgeGroup={controller.filterAgeGroup}
          filterActive={controller.filterActive}
          onSearchTermChange={controller.setSearchTerm}
          onFilterGenderChange={controller.setFilterGender}
          onFilterAgeGroupChange={controller.setFilterAgeGroup}
          onFilterActiveChange={controller.setFilterActive}
        />
      )}

      {!controller.supportsSpeakerManagement && (
        <div className="rounded-lg border border-border bg-accent/60 p-3 text-sm text-muted-foreground">
          VoxCPM2 使用参考音频与语气控制完成合成；这里管理参考音频，角色绑定会在生成时默认走 VoxCPM2。
        </div>
      )}

      <CreateSpeakerDialog
        open={controller.isCreateDialogOpen}
        newSpeaker={controller.newSpeaker}
        referenceAudios={controller.referenceAudios}
        onOpenChange={controller.setIsCreateDialogOpen}
        onNewSpeakerChange={controller.setNewSpeaker}
        onCreateSpeaker={controller.createSpeaker}
      />

      <UploadAudioDialog
        open={controller.isUploadDialogOpen}
        selectedAudioPreview={controller.selectedUploadPreview}
        isUploading={controller.isUploading}
        uploadProgress={controller.uploadProgress}
        onOpenChange={(open) => {
          controller.setIsUploadDialogOpen(open);
          if (!open && !controller.isUploading) {
            controller.selectUploadFile(null);
          }
        }}
        onSelectFile={controller.selectUploadFile}
        onUpload={controller.submitSelectedAudio}
      />

      <EditSpeakerDialog
        open={controller.isEditDialogOpen}
        editingSpeaker={controller.editingSpeaker}
        referenceAudios={controller.referenceAudios}
        onOpenChange={(open) => {
          controller.setIsEditDialogOpen(open);
          if (!open) {
            controller.setEditingSpeaker(null);
          }
        }}
        onEditingSpeakerChange={controller.setEditingSpeaker}
        onUpdateSpeaker={controller.updateSpeaker}
      />

      {controller.supportsSpeakerManagement ? (
        <Tabs defaultValue="speakers" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="speakers">说话人列表</TabsTrigger>
            <TabsTrigger value="audios">参考音频</TabsTrigger>
          </TabsList>

          <TabsContent value="speakers" className="space-y-4">
            <SpeakerListTab
              loading={controller.loading}
              speakers={controller.speakers}
              referenceAudios={controller.referenceAudios}
              currentPage={controller.currentPage}
              totalPages={controller.totalPages}
              isPlaying={controller.isPlaying}
              onSetIsPlaying={controller.setIsPlaying}
              onOpenEditDialog={controller.openEditDialog}
              onDeleteSpeaker={controller.deleteSpeaker}
              onPageChange={controller.setCurrentPage}
            />
          </TabsContent>

          <TabsContent value="audios" className="space-y-4">
            <ReferenceAudioTab
              loading={controller.loading}
              referenceAudios={controller.referenceAudios}
              paginatedReferenceAudios={controller.paginatedReferenceAudios}
              audioPage={controller.audioPage}
              audioTotalPages={controller.audioTotalPages}
              allowDelete
              selectedAudioFilenames={controller.selectedAudioFilenames}
              isPlaying={controller.isPlaying}
              onSetIsPlaying={controller.setIsPlaying}
              onTogglePlay={controller.togglePlay}
              onDeleteAudio={controller.deleteReferenceAudio}
              onToggleAudioSelection={controller.toggleAudioSelection}
              onSetAudioSelectionForMany={controller.setAudioSelectionForMany}
              onClearSelectedAudios={controller.clearSelectedAudios}
              onDeleteSelectedAudios={controller.deleteSelectedReferenceAudios}
              onAudioPageChange={controller.setAudioPage}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <ReferenceAudioTab
          loading={controller.loading}
          referenceAudios={controller.referenceAudios}
          paginatedReferenceAudios={controller.paginatedReferenceAudios}
          audioPage={controller.audioPage}
          audioTotalPages={controller.audioTotalPages}
          allowDelete
          selectedAudioFilenames={controller.selectedAudioFilenames}
          isPlaying={controller.isPlaying}
          onSetIsPlaying={controller.setIsPlaying}
          onTogglePlay={controller.togglePlay}
          onDeleteAudio={controller.deleteReferenceAudio}
          onToggleAudioSelection={controller.toggleAudioSelection}
          onSetAudioSelectionForMany={controller.setAudioSelectionForMany}
          onClearSelectedAudios={controller.clearSelectedAudios}
          onDeleteSelectedAudios={controller.deleteSelectedReferenceAudios}
          onAudioPageChange={controller.setAudioPage}
        />
      )}
    </div>
  );
}
