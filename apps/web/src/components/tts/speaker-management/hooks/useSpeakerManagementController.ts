import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IndexTTSService } from "@/lib/indextts-service";
import type {
  NewSpeakerForm,
  ProviderServiceStatus,
  ReferenceAudio,
  Speaker,
  TTSReferenceProvider,
  UploadAudioPreview,
} from "../types";
import { AUDIO_PAGE_SIZE, DEFAULT_NEW_SPEAKER_FORM } from "../utils";

const PROVIDER_STORAGE_KEY = "tts.speaker-management.provider";
const SUPPORTED_PROVIDER_LIST: readonly TTSReferenceProvider[] = [
  "indextts",
  "cosyvoice",
  "voxcpm",
];

const isTTSReferenceProvider = (value: unknown): value is TTSReferenceProvider =>
  SUPPORTED_PROVIDER_LIST.includes(value as TTSReferenceProvider);

export function useSpeakerManagementController() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [referenceAudios, setReferenceAudios] = useState<ReferenceAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerStatuses, setProviderStatuses] = useState<ProviderServiceStatus[]>([]);
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);

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
        return "indextts";
      }
      const storedProvider = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
      return isTTSReferenceProvider(storedProvider) ? storedProvider : "indextts";
    }
  );

  const supportsSpeakerManagement = selectedProvider === "indextts";
  const selectedProviderStatus = useMemo(
    () =>
      providerStatuses.find((status) => status.provider === selectedProvider) ||
      null,
    [providerStatuses, selectedProvider]
  );

  const fetchProviderStatuses = useCallback(async () => {
    setProviderStatusLoading(true);
    try {
      const response = await fetch("/api/tts/providers/status", {
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.data?.providers)) {
        setProviderStatuses(data.data.providers as ProviderServiceStatus[]);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch TTS provider statuses:", error);
    } finally {
      setProviderStatusLoading(false);
    }

    setProviderStatuses([]);
  }, []);

  const changeProvider = useCallback((provider: TTSReferenceProvider) => {
    if (provider === selectedProvider) {
      return;
    }
    setSelectedProvider(provider);
    setCurrentPage(1);
    setAudioPage(1);
    setSelectedAudioFilenames([]);
  }, [selectedProvider]);

  const audioTotalPages = Math.max(
    1,
    Math.ceil(referenceAudios.length / AUDIO_PAGE_SIZE)
  );
  const clampedAudioPage = Math.min(audioPage, audioTotalPages);

  const paginatedReferenceAudios = useMemo(() => {
    const startIndex = (clampedAudioPage - 1) * AUDIO_PAGE_SIZE;
    return referenceAudios.slice(startIndex, startIndex + AUDIO_PAGE_SIZE);
  }, [referenceAudios, clampedAudioPage]);

  const fetchSpeakers = useCallback(async () => {
    if (!supportsSpeakerManagement) {
      setSpeakers([]);
      setTotalPages(1);
      return;
    }

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(searchTerm && { search: searchTerm }),
        ...(filterGender && { gender: filterGender }),
        ...(filterAgeGroup && { ageGroup: filterAgeGroup }),
        ...(filterActive && { isActive: filterActive }),
      });

      const response = await fetch(`/api/tts/speakers?${params}`);
      const data = await response.json();

      if (data.success) {
        setSpeakers(data.data.speakers);
        setTotalPages(data.data.pagination.totalPages);
      }
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
    supportsSpeakerManagement,
  ]);

  const fetchReferenceAudios = useCallback(async () => {
    try {
      const allAudios: ReferenceAudio[] = [];
      const limit = 20;
      let page = 1;
      let hasNext = true;

      while (hasNext) {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          provider: selectedProvider,
        });

        const response = await fetch(`/api/tts/reference-audio?${params}`);
        const data = await response.json();

        if (!data.success) {
          break;
        }

        allAudios.push(...data.data.audios);
        hasNext = data.data.pagination?.hasNext ?? false;
        page += 1;
      }

      setReferenceAudios(allAudios);
    } catch (error) {
      console.error("Failed to fetch reference audios:", error);
      toast.error("获取参考音频列表失败");
    }
  }, [selectedProvider]);

  useEffect(() => {
    setSelectedAudioFilenames((previous) => {
      const available = new Set(
        referenceAudios
          .filter((audio) => audio.audioType !== "example")
          .map((audio) => audio.filename)
      );
      return previous.filter((filename) => available.has(filename));
    });
  }, [referenceAudios]);

  const resetNewSpeaker = useCallback(() => {
    setNewSpeaker({ ...DEFAULT_NEW_SPEAKER_FORM });
  }, []);

  const createSpeaker = useCallback(async () => {
    if (!supportsSpeakerManagement) {
      toast.error("当前提供商不支持说话人管理");
      return;
    }

    try {
      const response = await fetch("/api/tts/speakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSpeaker),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || "创建说话人失败");
        return;
      }

      toast.success("说话人创建成功");
      setIsCreateDialogOpen(false);
      resetNewSpeaker();
      await fetchSpeakers();
    } catch (error) {
      console.error("Failed to create speaker:", error);
      toast.error("创建说话人失败");
    }
  }, [fetchSpeakers, newSpeaker, resetNewSpeaker, supportsSpeakerManagement]);

  const updateSpeaker = useCallback(async () => {
    if (!supportsSpeakerManagement) {
      toast.error("当前提供商不支持说话人管理");
      return;
    }

    if (!editingSpeaker) {
      return;
    }

    try {
      const response = await fetch(`/api/tts/speakers/${editingSpeaker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSpeaker.name,
          gender: editingSpeaker.gender,
          ageGroup: editingSpeaker.ageGroup,
          toneStyle: editingSpeaker.toneStyle,
          description: editingSpeaker.description,
          referenceAudio: editingSpeaker.referenceAudio,
          isActive: editingSpeaker.isActive,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || "更新说话人失败");
        return;
      }

      toast.success("说话人更新成功");
      setIsEditDialogOpen(false);
      setEditingSpeaker(null);
      await fetchSpeakers();
    } catch (error) {
      console.error("Failed to update speaker:", error);
      toast.error("更新说话人失败");
    }
  }, [editingSpeaker, fetchSpeakers, supportsSpeakerManagement]);

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
        const response = await fetch(`/api/tts/speakers/${speakerId}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!data.success) {
          toast.error(data.error || "删除说话人失败");
          return;
        }

        toast.success("说话人删除成功");
        await fetchSpeakers();
      } catch (error) {
        console.error("Failed to delete speaker:", error);
        toast.error("删除说话人失败");
      }
    },
    [fetchSpeakers, supportsSpeakerManagement]
  );

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

  const uploadReferenceAudio = useCallback(
    async (file: File, description?: string) => {
      setIsUploading(true);
      setUploadProgress(0);

      await new Promise<void>((resolve) => {
        const formData = new FormData();
        formData.append("file", file);
        if (description) {
          formData.append("description", description);
        }

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress((event.loaded / event.total) * 100);
          }
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            if (data.success) {
              toast.success("音频上传成功");
              setIsUploadDialogOpen(false);
              setSelectedUploadFile(null);
              setSelectedUploadPreview(null);
              setUploadProgress(0);
              await Promise.all([fetchReferenceAudios(), fetchSpeakers()]);
            } else {
              toast.error(data.error || "音频上传失败");
            }
          } else {
            toast.error("音频上传失败");
          }

          setIsUploading(false);
          resolve();
        });

        xhr.addEventListener("error", () => {
          toast.error("音频上传失败");
          setIsUploading(false);
          setUploadProgress(0);
          resolve();
        });

        xhr.open(
          "POST",
          `/api/tts/reference-audio?provider=${encodeURIComponent(selectedProvider)}`
        );
        xhr.send(formData);
      });
    },
    [fetchReferenceAudios, fetchSpeakers, selectedProvider]
  );

  const submitSelectedAudio = useCallback(async () => {
    if (!selectedUploadFile) {
      return;
    }

    const validation = IndexTTSService.validateAudioFile(selectedUploadFile);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    await uploadReferenceAudio(
      selectedUploadFile,
      selectedUploadPreview?.originalName
    );
  }, [selectedUploadFile, selectedUploadPreview?.originalName, uploadReferenceAudio]);

  const requestDeleteReferenceAudio = useCallback(
    async (filename: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const response = await fetch(
          `/api/tts/reference-audio?provider=${encodeURIComponent(
            selectedProvider
          )}&filename=${encodeURIComponent(filename)}`,
          {
            method: "DELETE",
          }
        );

        const data = await response.json();

        if (!data.success) {
          return {
            ok: false,
            error: data.error || "音频删除失败",
          };
        }
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
      setSelectedAudioFilenames((previous) =>
        previous.filter((item) => item !== filename)
      );
      await Promise.all([fetchReferenceAudios(), fetchSpeakers()]);
    },
    [fetchReferenceAudios, fetchSpeakers, requestDeleteReferenceAudio]
  );

  const toggleAudioSelection = useCallback((filename: string, checked: boolean) => {
    setSelectedAudioFilenames((previous) => {
      if (checked) {
        if (previous.includes(filename)) {
          return previous;
        }
        return [...previous, filename];
      }
      return previous.filter((item) => item !== filename);
    });
  }, []);

  const setAudioSelectionForMany = useCallback(
    (filenames: string[], checked: boolean) => {
      const targets = filenames.filter(Boolean);
      if (targets.length === 0) {
        return;
      }

      setSelectedAudioFilenames((previous) => {
        if (checked) {
          const merged = new Set([...previous, ...targets]);
          return Array.from(merged);
        }
        const blocked = new Set(targets);
        return previous.filter((item) => !blocked.has(item));
      });
    },
    []
  );

  const clearSelectedAudios = useCallback(() => {
    setSelectedAudioFilenames([]);
  }, []);

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

      setSelectedAudioFilenames((previous) =>
        previous.filter((item) => !targets.includes(item))
      );
      await Promise.all([fetchReferenceAudios(), fetchSpeakers()]);
    },
    [fetchReferenceAudios, fetchSpeakers, requestDeleteReferenceAudio]
  );

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProvider);
  }, [selectedProvider]);

  return {
    selectedProvider,
    selectedProviderStatus,
    providerStatuses,
    providerStatusLoading,
    setSelectedProvider: changeProvider,
    refreshProviderStatuses: fetchProviderStatuses,
    supportsSpeakerManagement,
    speakers,
    referenceAudios,
    selectedAudioFilenames,
    loading,
    searchTerm,
    filterGender,
    filterAgeGroup,
    filterActive,
    currentPage,
    totalPages,
    audioPage: clampedAudioPage,
    audioTotalPages,
    paginatedReferenceAudios,
    isCreateDialogOpen,
    isUploadDialogOpen,
    isEditDialogOpen,
    newSpeaker,
    editingSpeaker,
    selectedUploadPreview,
    isPlaying,
    uploadProgress,
    isUploading,
    setSearchTerm,
    setFilterGender,
    setFilterAgeGroup,
    setFilterActive,
    setCurrentPage,
    setAudioPage,
    setIsCreateDialogOpen,
    setIsUploadDialogOpen,
    setIsEditDialogOpen,
    setNewSpeaker,
    setEditingSpeaker,
    setIsPlaying,
    createSpeaker,
    updateSpeaker,
    deleteSpeaker,
    openEditDialog,
    selectUploadFile,
    submitSelectedAudio,
    deleteReferenceAudio,
    toggleAudioSelection,
    setAudioSelectionForMany,
    clearSelectedAudios,
    deleteSelectedReferenceAudios,
    togglePlay,
  };
}
