// 一旦我被更新，请更新我的开头注释
// input: 参考音频列表/Provider 存储状态
// output: speaker management 视图状态与本地交互
// pos: TTS speaker management
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  NewSpeakerForm,
  ReferenceAudio,
  Speaker,
  TTSReferenceProvider,
  UploadAudioPreview,
} from "../types";
import { AUDIO_PAGE_SIZE, DEFAULT_NEW_SPEAKER_FORM } from "../utils";
import { retainAvailableAudioSelections } from "./use-speaker-management-controller/reference-audio-requests";
import {
  isTTSReferenceProvider,
  PROVIDER_STORAGE_KEY,
} from "./use-speaker-management-controller/shared";

export function useSpeakerManagementViewState(referenceAudios: ReferenceAudio[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterAgeGroup, setFilterAgeGroup] = useState("");
  const [filterActive, setFilterActive] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [audioPage, setAudioPage] = useState(1);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [newSpeaker, setNewSpeaker] = useState<NewSpeakerForm>({
    ...DEFAULT_NEW_SPEAKER_FORM,
  });
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);

  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedUploadPreview, setSelectedUploadPreview] =
    useState<UploadAudioPreview | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAudioFilenames, setSelectedAudioFilenames] = useState<string[]>(
    []
  );

  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<TTSReferenceProvider>(
    () => {
      if (typeof window === "undefined") {
        return "voxcpm";
      }
      const storedProvider = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
      return isTTSReferenceProvider(storedProvider) ? storedProvider : "voxcpm";
    }
  );

  const audioTotalPages = Math.max(
    1,
    Math.ceil(referenceAudios.length / AUDIO_PAGE_SIZE)
  );
  const clampedAudioPage = Math.min(audioPage, audioTotalPages);

  const paginatedReferenceAudios = useMemo(() => {
    const startIndex = (clampedAudioPage - 1) * AUDIO_PAGE_SIZE;
    return referenceAudios.slice(startIndex, startIndex + AUDIO_PAGE_SIZE);
  }, [referenceAudios, clampedAudioPage]);

  const availableSelectedAudioFilenames = useMemo(
    () => retainAvailableAudioSelections(selectedAudioFilenames, referenceAudios),
    [referenceAudios, selectedAudioFilenames]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProvider);
  }, [selectedProvider]);

  const resetNewSpeaker = useCallback(() => {
    setNewSpeaker({ ...DEFAULT_NEW_SPEAKER_FORM });
  }, []);

  const openEditDialog = useCallback((speaker: Speaker) => {
    setEditingSpeaker(speaker);
    setIsEditDialogOpen(true);
  }, []);

  const selectUploadFile = useCallback((file: File | null) => {
    setSelectedUploadFile(file);

    if (!file) {
      setSelectedUploadPreview(null);
      return;
    }

    setSelectedUploadPreview({
      originalName: file.name,
      fileSize: file.size,
      format: file.type,
    });
  }, []);

  const clearSelectedAudios = useCallback(() => {
    setSelectedAudioFilenames([]);
  }, []);

  const togglePlay = useCallback(
    (audioKey: string, elementId: string) => {
      const audio = document.getElementById(elementId) as HTMLAudioElement | null;
      if (!audio) {
        return;
      }

      if (isPlaying === audioKey) {
        audio.pause();
        setIsPlaying(null);
        return;
      }

      void audio.play();
      setIsPlaying(audioKey);
    },
    [isPlaying]
  );

  return {
    searchTerm,
    filterGender,
    filterAgeGroup,
    filterActive,
    currentPage,
    totalPages,
    audioPage,
    audioTotalPages,
    clampedAudioPage,
    paginatedReferenceAudios,
    isCreateDialogOpen,
    isUploadDialogOpen,
    isEditDialogOpen,
    newSpeaker,
    editingSpeaker,
    selectedUploadFile,
    selectedUploadPreview,
    uploadProgress,
    isUploading,
    selectedAudioFilenames: availableSelectedAudioFilenames,
    isPlaying,
    selectedProvider,
    setSearchTerm,
    setFilterGender,
    setFilterAgeGroup,
    setFilterActive,
    setCurrentPage,
    setTotalPages,
    setAudioPage,
    setIsCreateDialogOpen,
    setIsUploadDialogOpen,
    setIsEditDialogOpen,
    setNewSpeaker,
    setEditingSpeaker,
    setSelectedUploadFile,
    setSelectedUploadPreview,
    setUploadProgress,
    setIsUploading,
    setSelectedAudioFilenames,
    setIsPlaying,
    setSelectedProvider,
    resetNewSpeaker,
    openEditDialog,
    selectUploadFile,
    clearSelectedAudios,
    togglePlay,
  };
}
