// 一旦我被更新，请更新我的开头注释
// input: props/TTS 依赖
// output: TTS UI
// pos: 领域组件
"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateSpeakerDialog } from "./speaker-management/dialogs/CreateSpeakerDialog";
import { EditSpeakerDialog } from "./speaker-management/dialogs/EditSpeakerDialog";
import { UploadAudioDialog } from "./speaker-management/dialogs/UploadAudioDialog";
import { useSpeakerManagementController } from "./speaker-management/hooks/useSpeakerManagementController";
import { SpeakerListTab } from "./speaker-management/panels/SpeakerListTab";
import { ReferenceAudioTab } from "./speaker-management/panels/ReferenceAudioTab";
import { SpeakerFilters } from "./speaker-management/SpeakerFilters";

export function SpeakerManagement() {
  const controller = useSpeakerManagementController();

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">说话人管理</h1>
        <div className="flex gap-2">
          <Button onClick={() => controller.setIsCreateDialogOpen(true)}>
            新建说话人
          </Button>
          <Button onClick={() => controller.setIsUploadDialogOpen(true)}>
            上传参考音频
          </Button>
        </div>
      </div>

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
            isPlaying={controller.isPlaying}
            onSetIsPlaying={controller.setIsPlaying}
            onTogglePlay={controller.togglePlay}
            onDeleteAudio={controller.deleteReferenceAudio}
            onAudioPageChange={controller.setAudioPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
