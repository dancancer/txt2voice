import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IndexTTSService } from "@/lib/indextts-service";
import type {
  NewSpeakerForm,
  ReferenceAudio,
  Speaker,
  UploadAudioPreview,
} from "../types";
import { AUDIO_PAGE_SIZE, DEFAULT_NEW_SPEAKER_FORM } from "../utils";

export function useSpeakerManagementController() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [referenceAudios, setReferenceAudios] = useState<ReferenceAudio[]>([]);
  const [loading, setLoading] = useState(true);

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

  const [isPlaying, setIsPlaying] = useState<string | null>(null);

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
  }, [currentPage, filterActive, filterAgeGroup, filterGender, searchTerm]);

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
  }, []);

  const resetNewSpeaker = useCallback(() => {
    setNewSpeaker({ ...DEFAULT_NEW_SPEAKER_FORM });
  }, []);

  const createSpeaker = useCallback(async () => {
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
  }, [fetchSpeakers, newSpeaker, resetNewSpeaker]);

  const updateSpeaker = useCallback(async () => {
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
  }, [editingSpeaker, fetchSpeakers]);

  const deleteSpeaker = useCallback(
    async (speakerId: string, speakerName: string) => {
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
    [fetchSpeakers]
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

        xhr.open("POST", "/api/tts/reference-audio");
        xhr.send(formData);
      });
    },
    [fetchReferenceAudios, fetchSpeakers]
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

  const deleteReferenceAudio = useCallback(
    async (filename: string) => {
      if (!confirm("确定要删除这个参考音频吗？")) {
        return;
      }

      try {
        const response = await fetch(
          `/api/tts/reference-audio?filename=${encodeURIComponent(filename)}`,
          {
            method: "DELETE",
          }
        );

        const data = await response.json();

        if (!data.success) {
          toast.error(data.error || "音频删除失败");
          return;
        }

        toast.success("音频删除成功");
        await Promise.all([fetchReferenceAudios(), fetchSpeakers()]);
      } catch (error) {
        console.error("Failed to delete audio:", error);
        toast.error("音频删除失败");
      }
    },
    [fetchReferenceAudios, fetchSpeakers]
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

  return {
    speakers,
    referenceAudios,
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
    togglePlay,
  };
}
