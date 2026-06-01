// 一旦我被更新，请更新我的开头注释
// input: speaker/reference-audio/provider 接口
// output: SpeakerManagement 统一控制器
// pos: TTS speaker management
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IndexTTSService } from "@/lib/indextts-service";
import type {
  ProviderServiceStatus,
  ReferenceAudio,
  Speaker,
  TTSReferenceProvider,
} from "../types";
import { fetchProviderStatusesRequest } from "./use-speaker-management-controller/provider-requests";
import {
  deleteReferenceAudioRequest,
  fetchReferenceAudiosRequest,
  removeDeletedAudioSelections,
  setAudioSelectionState,
  toggleSelectedAudioFilename,
  uploadReferenceAudioRequest,
} from "./use-speaker-management-controller/reference-audio-requests";
import {
  createSpeakerRequest,
  deleteSpeakerRequest,
  fetchSpeakersRequest,
  updateSpeakerRequest,
} from "./use-speaker-management-controller/speaker-requests";
import { useSpeakerManagementViewState } from "./useSpeakerManagementViewState";

export function useSpeakerManagementController() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [referenceAudios, setReferenceAudios] = useState<ReferenceAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerStatuses, setProviderStatuses] = useState<ProviderServiceStatus[]>([]);
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);
  const viewState = useSpeakerManagementViewState(referenceAudios);
  const {
    currentPage,
    searchTerm,
    filterGender,
    filterAgeGroup,
    filterActive,
    selectedProvider,
    setTotalPages,
  } = viewState;

  const supportsSpeakerManagement = false;
  const selectedProviderStatus = useMemo(
    () =>
      providerStatuses.find(
        (status) => status.provider === selectedProvider
      ) || null,
    [providerStatuses, selectedProvider]
  );

  const fetchProviderStatuses = useCallback(async () => {
    setProviderStatusLoading(true);
    try {
      setProviderStatuses(await fetchProviderStatusesRequest());
      return;
    } catch (error) {
      console.error("Failed to fetch TTS provider statuses:", error);
    } finally {
      setProviderStatusLoading(false);
    }

    setProviderStatuses([]);
  }, []);

  const changeProvider = useCallback(
    (provider: TTSReferenceProvider) => {
      if (provider === selectedProvider) {
        return;
      }

      viewState.setSelectedProvider(provider);
      viewState.setCurrentPage(1);
      viewState.setAudioPage(1);
      viewState.setSelectedAudioFilenames([]);
    },
    [selectedProvider, viewState]
  );

  const fetchSpeakers = useCallback(async () => {
    if (!supportsSpeakerManagement) {
      setSpeakers([]);
      setTotalPages(1);
      return;
    }

    try {
      const result = await fetchSpeakersRequest({
        page: currentPage,
        searchTerm,
        filterGender,
        filterAgeGroup,
        filterActive,
      });
      setSpeakers(result.speakers);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error("Failed to fetch speakers:", error);
      toast.error("获取说话人列表失败");
    }
  }, [
    currentPage,
    filterActive,
    filterAgeGroup,
    filterGender,
    searchTerm,
    setTotalPages,
    supportsSpeakerManagement,
  ]);

  const fetchReferenceAudios = useCallback(async () => {
    try {
      setReferenceAudios(
        await fetchReferenceAudiosRequest(selectedProvider)
      );
    } catch (error) {
      console.error("Failed to fetch reference audios:", error);
      toast.error("获取参考音频列表失败");
    }
  }, [selectedProvider]);

  const createSpeaker = useCallback(async () => {
    if (!supportsSpeakerManagement) {
      toast.error("当前提供商不支持说话人管理");
      return;
    }

    try {
      await createSpeakerRequest(viewState.newSpeaker);
      toast.success("说话人创建成功");
      viewState.setIsCreateDialogOpen(false);
      viewState.resetNewSpeaker();
      await fetchSpeakers();
    } catch (error) {
      console.error("Failed to create speaker:", error);
      toast.error("创建说话人失败");
    }
  }, [fetchSpeakers, supportsSpeakerManagement, viewState]);

  const updateSpeaker = useCallback(async () => {
    if (!supportsSpeakerManagement) {
      toast.error("当前提供商不支持说话人管理");
      return;
    }

    if (!viewState.editingSpeaker) {
      return;
    }

    try {
      await updateSpeakerRequest(viewState.editingSpeaker);
      toast.success("说话人更新成功");
      viewState.setIsEditDialogOpen(false);
      viewState.setEditingSpeaker(null);
      await fetchSpeakers();
    } catch (error) {
      console.error("Failed to update speaker:", error);
      toast.error("更新说话人失败");
    }
  }, [fetchSpeakers, supportsSpeakerManagement, viewState]);

  const deleteSpeaker = useCallback(
    async (speakerId: string, speakerName: string) => {
      if (!supportsSpeakerManagement) {
        toast.error("当前提供商不支持说话人管理");
        return;
      }

      if (!confirm(`确定要删除说话人"${speakerName}"吗？此操作不可撤销。`)) {
        return;
      }

      try {
        await deleteSpeakerRequest(speakerId);
        toast.success("说话人删除成功");
        await fetchSpeakers();
      } catch (error) {
        console.error("Failed to delete speaker:", error);
        toast.error("删除说话人失败");
      }
    },
    [fetchSpeakers, supportsSpeakerManagement]
  );

  const uploadReferenceAudio = useCallback(
    async (file: File, description?: string) => {
      viewState.setIsUploading(true);
      viewState.setUploadProgress(0);

      try {
        await uploadReferenceAudioRequest({
          file,
          provider: selectedProvider,
          description,
          onProgress: viewState.setUploadProgress,
        });
        toast.success("音频上传成功");
        viewState.setIsUploadDialogOpen(false);
        viewState.setSelectedUploadFile(null);
        viewState.setSelectedUploadPreview(null);
        viewState.setUploadProgress(0);
        await Promise.all([fetchReferenceAudios(), fetchSpeakers()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "音频上传失败");
        viewState.setUploadProgress(0);
      } finally {
        viewState.setIsUploading(false);
      }
    },
    [fetchReferenceAudios, fetchSpeakers, selectedProvider, viewState]
  );

  const submitSelectedAudio = useCallback(async () => {
    if (!viewState.selectedUploadFile) {
      return;
    }

    const validation = IndexTTSService.validateAudioFile(
      viewState.selectedUploadFile
    );
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    await uploadReferenceAudio(
      viewState.selectedUploadFile,
      viewState.selectedUploadPreview?.originalName
    );
  }, [uploadReferenceAudio, viewState.selectedUploadFile, viewState.selectedUploadPreview]);

  const requestDeleteReferenceAudio = useCallback(
    async (filename: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        await deleteReferenceAudioRequest({
          provider: selectedProvider,
          filename,
        });
        return { ok: true };
      } catch (error) {
        console.error("Failed to delete audio:", error);
        return {
          ok: false,
          error: "音频删除失败",
        };
      }
    },
    [selectedProvider]
  );

  const deleteReferenceAudio = useCallback(
    async (filename: string) => {
      if (!confirm("确定要删除这个参考音频吗？")) {
        return;
      }

      const result = await requestDeleteReferenceAudio(filename);
      if (!result.ok) {
        toast.error(result.error || "音频删除失败");
        return;
      }

      toast.success("音频删除成功");
      viewState.setSelectedAudioFilenames((previous) =>
        previous.filter((item) => item !== filename)
      );
      await Promise.all([fetchReferenceAudios(), fetchSpeakers()]);
    },
    [fetchReferenceAudios, fetchSpeakers, requestDeleteReferenceAudio, viewState]
  );

  const toggleAudioSelection = useCallback((filename: string, checked: boolean) => {
    viewState.setSelectedAudioFilenames((previous) =>
      toggleSelectedAudioFilename(previous, filename, checked)
    );
  }, [viewState]);

  const setAudioSelectionForMany = useCallback(
    (filenames: string[], checked: boolean) => {
      viewState.setSelectedAudioFilenames((previous) =>
        setAudioSelectionState(previous, filenames, checked)
      );
    },
    [viewState]
  );

  const deleteSelectedReferenceAudios = useCallback(
    async (filenames: string[]) => {
      const targets = Array.from(new Set(filenames));
      if (targets.length === 0) {
        return;
      }

      if (!confirm(`确定要删除选中的 ${targets.length} 个参考音频吗？`)) {
        return;
      }

      let successCount = 0;
      let failedCount = 0;

      for (const filename of targets) {
        const result = await requestDeleteReferenceAudio(filename);
        if (result.ok) {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      }

      if (successCount > 0) {
        toast.success(`成功删除 ${successCount} 个音频`);
      }
      if (failedCount > 0) {
        toast.error(`删除失败 ${failedCount} 个音频`);
      }

      viewState.setSelectedAudioFilenames((previous) =>
        removeDeletedAudioSelections(previous, targets)
      );
      await Promise.all([fetchReferenceAudios(), fetchSpeakers()]);
    },
    [fetchReferenceAudios, fetchSpeakers, requestDeleteReferenceAudio, viewState]
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSpeakers(), fetchReferenceAudios()]);
      setLoading(false);
    };

    void loadData();
  }, [fetchReferenceAudios, fetchSpeakers]);

  useEffect(() => {
    void fetchProviderStatuses();
  }, [fetchProviderStatuses]);

  return {
    selectedProvider: viewState.selectedProvider,
    selectedProviderStatus,
    providerStatuses,
    providerStatusLoading,
    setSelectedProvider: changeProvider,
    refreshProviderStatuses: fetchProviderStatuses,
    supportsSpeakerManagement,
    speakers,
    referenceAudios,
    selectedAudioFilenames: viewState.selectedAudioFilenames,
    loading,
    searchTerm: viewState.searchTerm,
    filterGender: viewState.filterGender,
    filterAgeGroup: viewState.filterAgeGroup,
    filterActive: viewState.filterActive,
    currentPage: viewState.currentPage,
    totalPages: viewState.totalPages,
    audioPage: viewState.clampedAudioPage,
    audioTotalPages: viewState.audioTotalPages,
    paginatedReferenceAudios: viewState.paginatedReferenceAudios,
    isCreateDialogOpen: viewState.isCreateDialogOpen,
    isUploadDialogOpen: viewState.isUploadDialogOpen,
    isEditDialogOpen: viewState.isEditDialogOpen,
    newSpeaker: viewState.newSpeaker,
    editingSpeaker: viewState.editingSpeaker,
    selectedUploadPreview: viewState.selectedUploadPreview,
    isPlaying: viewState.isPlaying,
    uploadProgress: viewState.uploadProgress,
    isUploading: viewState.isUploading,
    setSearchTerm: viewState.setSearchTerm,
    setFilterGender: viewState.setFilterGender,
    setFilterAgeGroup: viewState.setFilterAgeGroup,
    setFilterActive: viewState.setFilterActive,
    setCurrentPage: viewState.setCurrentPage,
    setAudioPage: viewState.setAudioPage,
    setIsCreateDialogOpen: viewState.setIsCreateDialogOpen,
    setIsUploadDialogOpen: viewState.setIsUploadDialogOpen,
    setIsEditDialogOpen: viewState.setIsEditDialogOpen,
    setNewSpeaker: viewState.setNewSpeaker,
    setEditingSpeaker: viewState.setEditingSpeaker,
    setIsPlaying: viewState.setIsPlaying,
    createSpeaker,
    updateSpeaker,
    deleteSpeaker,
    openEditDialog: viewState.openEditDialog,
    selectUploadFile: viewState.selectUploadFile,
    submitSelectedAudio,
    deleteReferenceAudio,
    toggleAudioSelection,
    setAudioSelectionForMany,
    clearSelectedAudios: viewState.clearSelectedAudios,
    deleteSelectedReferenceAudios,
    togglePlay: viewState.togglePlay,
  };
}
